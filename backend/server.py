from fastapi import FastAPI, APIRouter, HTTPException, Depends
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime, timezone
from emergentintegrations.llm.chat import LlmChat, UserMessage
import re

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Models
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

class UserSession(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    session_id: str
    searches_used: int = 0
    has_paid: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Helper functions
def prepare_for_mongo(data):
    if isinstance(data.get('created_at'), datetime):
        data['created_at'] = data['created_at'].isoformat()
    return data

def parse_from_mongo(item):
    if isinstance(item.get('created_at'), str):
        item['created_at'] = datetime.fromisoformat(item['created_at'])
    return item

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
        }
    ]
    
    # Clear existing programs
    await db.programs.delete_many({})
    
    # Insert sample programs
    for program_data in sample_programs:
        program = Program(**program_data)
        program_dict = prepare_for_mongo(program.dict())
        await db.programs.insert_one(program_dict)
    
    return {"message": f"Initialized {len(sample_programs)} programs"}

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

# Session management
async def get_or_create_session(session_id: str) -> UserSession:
    """Get existing session or create new one"""
    session_doc = await db.user_sessions.find_one({"session_id": session_id})
    
    if session_doc:
        return UserSession(**parse_from_mongo(session_doc))
    else:
        new_session = UserSession(session_id=session_id)
        session_dict = prepare_for_mongo(new_session.dict())
        await db.user_sessions.insert_one(session_dict)
        return new_session

async def update_session(session: UserSession):
    """Update session in database"""
    session_dict = prepare_for_mongo(session.dict())
    await db.user_sessions.update_one(
        {"session_id": session.session_id},
        {"$set": session_dict}
    )

# API Routes
@api_router.get("/")
async def root():
    return {"message": "Jacksonville Programs Finder API"}

@api_router.post("/search", response_model=SearchResult)
async def search_programs(search_query: SearchQuery, session_id: str = "default"):
    """AI-powered program search with paywall"""
    # Get or create user session
    session = await get_or_create_session(session_id)
    
    # Check if user has exceeded free searches and hasn't paid
    if session.searches_used >= 2 and not session.has_paid:
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
    
    # Update session search count
    session.searches_used += 1
    await update_session(session)
    
    return search_result

@api_router.get("/programs", response_model=List[Program])
async def get_all_programs():
    """Get all programs (admin view)"""
    programs_cursor = db.programs.find()
    programs_docs = await programs_cursor.to_list(length=None)
    return [Program(**parse_from_mongo(doc)) for doc in programs_docs]

@api_router.post("/programs", response_model=Program)
async def create_program(program_data: ProgramCreate):
    """Create new program (admin)"""
    program = Program(**program_data.dict())
    program_dict = prepare_for_mongo(program.dict())
    await db.programs.insert_one(program_dict)
    return program

@api_router.delete("/programs/{program_id}")
async def delete_program(program_id: str):
    """Delete program (admin)"""
    result = await db.programs.delete_one({"id": program_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Program not found")
    return {"message": "Program deleted successfully"}

@api_router.get("/session/{session_id}")
async def get_session_info(session_id: str):
    """Get session information"""
    session = await get_or_create_session(session_id)
    return {
        "searches_used": session.searches_used,
        "searches_remaining": max(0, 2 - session.searches_used) if not session.has_paid else "unlimited",
        "has_paid": session.has_paid
    }

@api_router.post("/payment/mock-success/{session_id}")
async def mock_payment_success(session_id: str):
    """Mock payment success for testing"""
    session = await get_or_create_session(session_id)
    session.has_paid = True
    await update_session(session)
    return {"message": "Payment successful - unlimited searches activated"}

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