from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
from emergentintegrations.llm.chat import LlmChat, UserMessage
import re
import jwt
import bcrypt

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Security
security = HTTPBearer()
SECRET_KEY = os.environ.get('JWT_SECRET_KEY', 'jacksonville-programs-finder-secret-key')
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Models
class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: EmailStr
    full_name: str
    hashed_password: str
    is_active: bool = True
    searches_used: int = 0
    has_subscription: bool = False
    subscription_date: Optional[datetime] = None
    reset_token: Optional[str] = None
    reset_token_expires: Optional[datetime] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    last_login: Optional[datetime] = None

class UserCreate(BaseModel):
    email: EmailStr
    full_name: str
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: str
    email: str
    full_name: str
    searches_used: int
    has_subscription: bool
    subscription_date: Optional[datetime] = None
    created_at: datetime

class Token(BaseModel):
    access_token: str
    token_type: str

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class ResetPasswordRequest(BaseModel):
    email: EmailStr
    reset_token: str
    new_password: str

class ForgotPasswordResponse(BaseModel):
    message: str
    reset_token: str  # In production, this would be sent via email

class SearchHistory(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    query: str
    results_count: int
    search_explanation: str
    search_date: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Program(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    program: str
    category: str
    agency: str
    eligibility: str
    apply_url: str
    phone: str
    notes: str
    source: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ProgramCreate(BaseModel):
    program: str
    category: str
    agency: str
    eligibility: str
    apply_url: str
    phone: str
    notes: str
    source: str

class SearchQuery(BaseModel):
    query: str
    category: Optional[str] = None

class SearchResult(BaseModel):
    programs: List[Program]
    total_found: int
    search_explanation: str

# Helper functions
def prepare_for_mongo(data):
    if isinstance(data.get('created_at'), datetime):
        data['created_at'] = data['created_at'].isoformat()
    if isinstance(data.get('search_date'), datetime):
        data['search_date'] = data['search_date'].isoformat()
    if isinstance(data.get('subscription_date'), datetime):
        data['subscription_date'] = data['subscription_date'].isoformat()
    if isinstance(data.get('last_login'), datetime):
        data['last_login'] = data['last_login'].isoformat()
    if isinstance(data.get('reset_token_expires'), datetime):
        data['reset_token_expires'] = data['reset_token_expires'].isoformat()
    return data

def parse_from_mongo(item):
    if isinstance(item.get('created_at'), str):
        item['created_at'] = datetime.fromisoformat(item['created_at'])
    if isinstance(item.get('search_date'), str):
        item['search_date'] = datetime.fromisoformat(item['search_date'])
    if isinstance(item.get('subscription_date'), str):
        item['subscription_date'] = datetime.fromisoformat(item['subscription_date'])
    if isinstance(item.get('last_login'), str):
        item['last_login'] = datetime.fromisoformat(item['last_login'])
    if isinstance(item.get('reset_token_expires'), str):
        item['reset_token_expires'] = datetime.fromisoformat(item['reset_token_expires'])
    return item

# Password hashing
def verify_password(plain_password: str, hashed_password: str) -> bool:
    # Truncate password to 72 bytes for bcrypt compatibility
    password_bytes = plain_password.encode('utf-8')[:72]
    return bcrypt.checkpw(password_bytes, hashed_password.encode('utf-8'))

def get_password_hash(password: str) -> str:
    # Truncate password to 72 bytes for bcrypt compatibility
    password_bytes = password.encode('utf-8')[:72]
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password_bytes, salt).decode('utf-8')

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def create_reset_token() -> str:
    """Generate a random reset token"""
    return str(uuid.uuid4()).replace('-', '')[:16].upper()

async def get_user_by_email(email: str) -> Optional[User]:
    user_doc = await db.users.find_one({"email": email})
    if user_doc:
        return User(**parse_from_mongo(user_doc))
    return None

async def get_user_by_id(user_id: str) -> Optional[User]:
    user_doc = await db.users.find_one({"id": user_id})
    if user_doc:
        return User(**parse_from_mongo(user_doc))
    return None

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except jwt.PyJWTError:
        raise credentials_exception
    
    user = await get_user_by_id(user_id)
    if user is None:
        raise credentials_exception
    return user

# Initialize programs from CSV data
@api_router.post("/admin/init-programs")
async def init_programs():
    """Initialize database with sample programs"""
    sample_programs = [
        {
            "program": "Facade Renovation Matching Grant Program",
            "category": "Façade / Commercial Improvement Grant",
            "agency": "City of Jacksonville - Office of Economic Development",
            "eligibility": "Existing commercial/retail businesses in designated Economically Distressed Areas; no liens; current on property taxes",
            "apply_url": "https://www.jacksonville.gov/departments/office-of-economic-development/facade-renovation-matching-grant-program",
            "phone": "(904) 255-5451",
            "notes": "50% reimbursement after project completion; max $10,000 match",
            "source": "jacksonville.gov"
        },
        {
            "program": "Neighborhood Energy Efficiency Program",
            "category": "Utility / Energy / Water Conservation",
            "agency": "JEA",
            "eligibility": "Low or fixed income residents in designated census tracts (≥50% residents ≤150% FPL)",
            "apply_url": "https://www.jea.com/about/community_impact/neighborhood_energy_efficiency_program/",
            "phone": "(904) 665-6000",
            "notes": "Free LED bulbs, water-saving devices, insulation, etc.",
            "source": "jea.com"
        },
        {
            "program": "Residential Rebates (Ways to Save)",
            "category": "Rebates / Energy Efficiency",
            "agency": "JEA",
            "eligibility": "Residential JEA customers; some require JEA-approved contractors",
            "apply_url": "https://www.jea.com/ways_to_save/residential_rebates/",
            "phone": "(904) 665-6000",
            "notes": "Rebates for appliances, insulation, thermostats, toilets",
            "source": "jea.com"
        },
        {
            "program": "Low-Income Home Energy Assistance Program (LIHEAP)",
            "category": "Federal / State Utility Assistance",
            "agency": "Florida Department of Economic Opportunity",
            "eligibility": "Household income ≤60% state median income OR ≤150% FPL; responsible for utility bill",
            "apply_url": "https://floridajobs.org/community-planning-and-development/community-services/low-income-home-energy-assistance-program",
            "phone": "1-800-342-3557",
            "notes": "Helps pay heating/cooling bills, emergency energy costs",
            "source": "floridajobs.org"
        },
        {
            "program": "Façade Beautification Grant Program",
            "category": "Façade / CRA Area Improvement",
            "agency": "Jacksonville Beach CRA",
            "eligibility": "Commercial property/business owners in Jax Beach CRA district",
            "apply_url": "https://www.jacksonvillebeach.org/563/Faade-Grant-Program",
            "phone": "(904) 247-6231",
            "notes": "Matching up to 2:1, max $100,000",
            "source": "jacksonvillebeach.org"
        },
        {
            "program": "Springfield Historic District / SPAR Facade Grant",
            "category": "Façade / Historic District Improvement",
            "agency": "Springfield Preservation and Revitalization (SPAR) Council",
            "eligibility": "Property in Springfield Historic District; must apply before work; SPAR membership required",
            "apply_url": "https://www.sparcouncil.org/facade_grant",
            "phone": "(904) 353-7727",
            "notes": "50% matching, $250 - $5,000 per project",
            "source": "sparcouncil.org"
        },
        {
            "program": "City Emergency Financial Assistance Program",
            "category": "Emergency Financial Assistance",
            "agency": "City of Jacksonville Social Services",
            "eligibility": "Duval County residents experiencing financial hardship, income requirements apply",
            "apply_url": "https://www.jacksonville.gov/departments/parks-and-recreation/social-services/emergency-financial-assistance-program",
            "phone": "(904) 255-8236",
            "notes": "Provides emergency assistance for rent, utilities, and other basic needs",
            "source": "jacksonville.gov"
        },
        {
            "program": "Jacksonville Housing Authority Rental Assistance",
            "category": "Housing Assistance",
            "agency": "Jacksonville Housing Authority",
            "eligibility": "Low-income families, elderly, and disabled individuals in Duval County",
            "apply_url": "https://www.jaxha.org",
            "phone": "(904) 630-3300",
            "notes": "Section 8 Housing Choice Vouchers and public housing assistance",
            "source": "jaxha.org"
        }
    ]
    
    # Insert sample programs (don't clear existing ones)
    for program_data in sample_programs:
        # Check if program already exists
        existing = await db.programs.find_one({"program": program_data["program"]})
        if not existing:
            program = Program(**program_data)
            program_dict = prepare_for_mongo(program.dict())
            await db.programs.insert_one(program_dict)
    
    total_count = await db.programs.count_documents({})
    return {"message": f"Sample programs initialized. Total programs: {total_count}"}

# AI-powered search
async def ai_search_programs(query: str, all_programs: List[Program]) -> SearchResult:
    """Use AI to match user query with relevant programs"""
    try:
        # Initialize LLM chat
        chat = LlmChat(
            api_key=os.environ.get('EMERGENT_LLM_KEY'),
            session_id=f"search_{uuid.uuid4()}",
            system_message="""You are an expert assistant for Jacksonville government assistance programs. 
            When users describe their needs, match them with the most relevant programs from the provided list.
            
            Respond with ONLY a JSON object containing:
            {
                "relevant_program_ids": ["id1", "id2", ...],
                "explanation": "Brief explanation of why these programs match the user's needs"
            }
            
            Consider these matching criteria:
            - Keywords in program names and descriptions
            - Eligibility requirements that match user's situation
            - Categories and agencies that serve user's needs
            - Notes and benefits that address user's specific problems
            
            Examples of user queries and what they might need:
            - "help with electric bill" → utility assistance programs
            - "small business facade grant" → commercial improvement grants
            - "energy efficiency rebates" → JEA rebate programs
            - "low income housing help" → housing assistance programs
            - "emergency financial assistance" → crisis aid programs"""
        ).with_model("openai", "gpt-4o-mini")
        
        # Create program context for AI
        program_context = "\n".join([
            f"ID: {p.id}\nProgram: {p.program}\nCategory: {p.category}\nAgency: {p.agency}\nEligibility: {p.eligibility}\nNotes: {p.notes}\n---"
            for p in all_programs
        ])
        
        user_message = UserMessage(
            text=f"User query: '{query}'\n\nAvailable programs:\n{program_context}\n\nFind the most relevant programs for this user's needs."
        )
        
        response = await chat.send_message(user_message)
        
        # Parse AI response
        import json
        try:
            ai_result = json.loads(response)
            relevant_ids = ai_result.get('relevant_program_ids', [])
            explanation = ai_result.get('explanation', 'Programs found based on your search.')
            
            # Filter programs by AI-selected IDs
            relevant_programs = [p for p in all_programs if p.id in relevant_ids]
            
            return SearchResult(
                programs=relevant_programs,
                total_found=len(relevant_programs),
                search_explanation=explanation
            )
        except json.JSONDecodeError:
            # Fallback to simple text search if AI response parsing fails
            return await simple_text_search(query, all_programs)
            
    except Exception as e:
        # Fallback to simple search if AI fails
        logging.error(f"AI search failed: {e}")
        return await simple_text_search(query, all_programs)

async def simple_text_search(query: str, all_programs: List[Program]) -> SearchResult:
    """Fallback simple text search"""
    query_lower = query.lower()
    relevant_programs = []
    
    for program in all_programs:
        # Check if query matches any field
        searchable_text = f"{program.program} {program.category} {program.agency} {program.eligibility} {program.notes}".lower()
        if any(word in searchable_text for word in query_lower.split()):
            relevant_programs.append(program)
    
    return SearchResult(
        programs=relevant_programs,
        total_found=len(relevant_programs),
        search_explanation=f"Found {len(relevant_programs)} programs matching your search terms."
    )

# Authentication Routes
@api_router.post("/auth/register", response_model=UserResponse)
async def register_user(user_create: UserCreate):
    """Register a new user"""
    # Check if user already exists
    existing_user = await get_user_by_email(user_create.email)
    if existing_user:
        raise HTTPException(
            status_code=400,
            detail="Email already registered"
        )
    
    # Create new user
    hashed_password = get_password_hash(user_create.password)
    user = User(
        email=user_create.email,
        full_name=user_create.full_name,
        hashed_password=hashed_password
    )
    
    user_dict = prepare_for_mongo(user.dict())
    await db.users.insert_one(user_dict)
    
    return UserResponse(**user.dict())

@api_router.post("/auth/login", response_model=Token)
async def login_user(user_login: UserLogin):
    """Login user and return access token"""
    user = await get_user_by_email(user_login.email)
    if not user or not verify_password(user_login.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Update last login
    user.last_login = datetime.now(timezone.utc)
    user_dict = prepare_for_mongo(user.dict())
    await db.users.update_one({"id": user.id}, {"$set": user_dict})
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.id}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@api_router.get("/auth/me", response_model=UserResponse)
async def get_current_user_info(current_user: User = Depends(get_current_user)):
    """Get current user information"""
    return UserResponse(**current_user.dict())

@api_router.get("/user/search-history")
async def get_user_search_history(current_user: User = Depends(get_current_user)):
    """Get user's search history"""
    history_cursor = db.search_history.find({"user_id": current_user.id}).sort("search_date", -1).limit(50)
    history_docs = await history_cursor.to_list(length=50)
    return [SearchHistory(**parse_from_mongo(doc)) for doc in history_docs]

# API Routes
@api_router.get("/")
async def root():
    return {"message": "Jacksonville Programs Finder API"}

@api_router.post("/search", response_model=SearchResult)
async def search_programs(search_query: SearchQuery, current_user: User = Depends(get_current_user)):
    """AI-powered program search for authenticated users"""
    # Check if user has exceeded free searches and doesn't have subscription
    if current_user.searches_used >= 2 and not current_user.has_subscription:
        raise HTTPException(
            status_code=402, 
            detail="Free search limit reached. Please subscribe for unlimited searches."
        )
    
    # Get all programs
    programs_cursor = db.programs.find()
    programs_docs = await programs_cursor.to_list(length=None)
    programs = [Program(**parse_from_mongo(doc)) for doc in programs_docs]
    
    if not programs:
        raise HTTPException(status_code=404, detail="No programs found. Please initialize the database.")
    
    # Perform AI search
    search_result = await ai_search_programs(search_query.query, programs)
    
    # Update user search count
    current_user.searches_used += 1
    user_dict = prepare_for_mongo(current_user.dict())
    await db.users.update_one({"id": current_user.id}, {"$set": user_dict})
    
    # Save search to history
    search_history = SearchHistory(
        user_id=current_user.id,
        query=search_query.query,
        results_count=search_result.total_found,
        search_explanation=search_result.search_explanation
    )
    history_dict = prepare_for_mongo(search_history.dict())
    await db.search_history.insert_one(history_dict)
    
    return search_result

# Legacy search endpoint for non-authenticated users (with session-based limiting)
@api_router.post("/search-guest", response_model=SearchResult)
async def search_programs_guest(search_query: SearchQuery, session_id: str = "default"):
    """AI-powered program search for guest users"""
    # For guest users, use simple session-based limiting (legacy functionality)
    # This can be used for demo purposes or as a fallback
    
    # Get all programs
    programs_cursor = db.programs.find()
    programs_docs = await programs_cursor.to_list(length=None)
    programs = [Program(**parse_from_mongo(doc)) for doc in programs_docs]
    
    if not programs:
        raise HTTPException(status_code=404, detail="No programs found.")
    
    # Perform AI search (limited functionality for guests)
    search_result = await ai_search_programs(search_query.query, programs[:3])  # Limit to 3 programs for guests
    
    return search_result

@api_router.get("/programs", response_model=List[Program])
async def get_all_programs():
    """Get all programs (admin view)"""
    programs_cursor = db.programs.find()
    programs_docs = await programs_cursor.to_list(length=None)
    return [Program(**parse_from_mongo(doc)) for doc in programs_docs]

@api_router.post("/programs", response_model=Program)
async def create_program(program_data: ProgramCreate, current_user: User = Depends(get_current_user)):
    """Create new program (authenticated users)"""
    program = Program(**program_data.dict())
    program_dict = prepare_for_mongo(program.dict())
    await db.programs.insert_one(program_dict)
    return program

@api_router.delete("/programs/{program_id}")
async def delete_program(program_id: str, current_user: User = Depends(get_current_user)):
    """Delete program (authenticated users)"""
    result = await db.programs.delete_one({"id": program_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Program not found")
    return {"message": "Program deleted successfully"}

@api_router.post("/payment/subscribe")
async def subscribe_user(current_user: User = Depends(get_current_user)):
    """Subscribe user for unlimited searches"""
    current_user.has_subscription = True
    current_user.subscription_date = datetime.now(timezone.utc)
    user_dict = prepare_for_mongo(current_user.dict())
    await db.users.update_one({"id": current_user.id}, {"$set": user_dict})
    return {"message": "Subscription activated - unlimited searches enabled"}

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()