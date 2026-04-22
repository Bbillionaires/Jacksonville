import requests
import sys
import json
from datetime import datetime
import uuid

class JacksonvilleProgramsAPITester:
    def __init__(self, base_url="https://community-assist-jax.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.test_user_email = f"test_user_{datetime.now().strftime('%H%M%S')}@example.com"
        self.test_user_password = "TestPass123!"
        self.test_user_name = "Test User"
        self.access_token = None
        self.tests_run = 0
        self.tests_passed = 0

    def run_test(self, name, method, endpoint, expected_status, data=None, params=None, auth_required=False):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        
        # Add authorization header if required and token is available
        if auth_required and self.access_token:
            headers['Authorization'] = f'Bearer {self.access_token}'

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        if auth_required:
            print(f"   Auth: {'✅ Token provided' if self.access_token else '❌ No token'}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, params=params)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, params=params)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    response_data = response.json()
                    if isinstance(response_data, dict) and len(str(response_data)) < 200:
                        print(f"   Response: {response_data}")
                    elif isinstance(response_data, list):
                        print(f"   Response: List with {len(response_data)} items")
                    else:
                        print(f"   Response: {str(response_data)[:100]}...")
                except:
                    print(f"   Response: {response.text[:100]}...")
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                print(f"   Response: {response.text[:200]}...")

            return success, response.json() if response.text and response.text.strip() else {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_api_health(self):
        """Test basic API health check"""
        return self.run_test("API Health Check", "GET", "", 200)

    def test_init_programs(self):
        """Test initializing sample programs"""
        return self.run_test("Initialize Programs", "POST", "admin/init-programs", 200)

    def test_get_all_programs(self):
        """Test getting all programs (admin view)"""
        success, response = self.run_test("Get All Programs", "GET", "programs", 200)
        if success and isinstance(response, list):
            print(f"   Found {len(response)} programs")
            if len(response) > 0:
                print(f"   Sample program: {response[0].get('program', 'N/A')}")
        return success, response

    def test_user_registration(self):
        """Test user registration"""
        user_data = {
            "email": self.test_user_email,
            "full_name": self.test_user_name,
            "password": self.test_user_password
        }
        
        success, response = self.run_test(
            "User Registration",
            "POST",
            "auth/register",
            200,
            data=user_data
        )
        
        if success:
            print(f"   Registered user: {response.get('email', 'N/A')}")
            print(f"   User ID: {response.get('id', 'N/A')}")
            print(f"   Searches used: {response.get('searches_used', 0)}")
            print(f"   Has subscription: {response.get('has_subscription', False)}")
        
        return success, response

    def test_duplicate_registration(self):
        """Test duplicate user registration (should fail)"""
        user_data = {
            "email": self.test_user_email,
            "full_name": self.test_user_name,
            "password": self.test_user_password
        }
        
        return self.run_test(
            "Duplicate Registration (should fail)",
            "POST",
            "auth/register",
            400,  # Should fail with 400
            data=user_data
        )

    def test_user_login(self):
        """Test user login"""
        login_data = {
            "email": self.test_user_email,
            "password": self.test_user_password
        }
        
        success, response = self.run_test(
            "User Login",
            "POST",
            "auth/login",
            200,
            data=login_data
        )
        
        if success and 'access_token' in response:
            self.access_token = response['access_token']
            print(f"   Access token received: {self.access_token[:20]}...")
            print(f"   Token type: {response.get('token_type', 'N/A')}")
        
        return success, response

    def test_invalid_login(self):
        """Test login with invalid credentials"""
        login_data = {
            "email": self.test_user_email,
            "password": "wrong_password"
        }
        
        return self.run_test(
            "Invalid Login (should fail)",
            "POST",
            "auth/login",
            401,  # Should fail with 401
            data=login_data
        )

    def test_get_current_user(self):
        """Test getting current user info with JWT token"""
        return self.run_test(
            "Get Current User Info",
            "GET",
            "auth/me",
            200,
            auth_required=True
        )

    def test_unauthorized_access(self):
        """Test accessing protected endpoint without token"""
        # Temporarily remove token
        temp_token = self.access_token
        self.access_token = None
        
        success, response = self.run_test(
            "Unauthorized Access (should fail)",
            "GET",
            "auth/me",
            403,  # Should fail with 403 (FastAPI returns 403 for missing auth)
            auth_required=False
        )
        
        # Restore token
        self.access_token = temp_token
        return success, response

    def test_authenticated_search(self, query, expected_programs_min=1):
        """Test AI-powered search with authentication"""
        success, response = self.run_test(
            f"Authenticated Search: '{query}'",
            "POST",
            "search",
            200,
            data={"query": query},
            auth_required=True
        )
        
        if success:
            programs = response.get('programs', [])
            total_found = response.get('total_found', 0)
            explanation = response.get('search_explanation', '')
            
            print(f"   Found {total_found} programs")
            print(f"   Explanation: {explanation[:100]}...")
            
            if len(programs) >= expected_programs_min:
                print(f"   ✅ Found expected minimum programs ({expected_programs_min})")
                for i, program in enumerate(programs[:2]):  # Show first 2 programs
                    print(f"   Program {i+1}: {program.get('program', 'N/A')}")
            else:
                print(f"   ⚠️  Expected at least {expected_programs_min} programs, got {len(programs)}")
        
        return success, response

    def test_search_limit_trigger(self):
        """Test search limit after 2 searches (3rd should trigger 402)"""
        return self.run_test(
            "Search Limit Trigger (3rd search should fail)",
            "POST",
            "search",
            402,  # Expecting paywall error
            data={"query": "test search limit"},
            auth_required=True
        )

    def test_get_search_history(self):
        """Test getting user's search history"""
        success, response = self.run_test(
            "Get Search History",
            "GET",
            "user/search-history",
            200,
            auth_required=True
        )
        
        if success and isinstance(response, list):
            print(f"   Found {len(response)} search history entries")
            for i, search in enumerate(response[:2]):  # Show first 2 searches
                print(f"   Search {i+1}: '{search.get('query', 'N/A')}' - {search.get('results_count', 0)} results")
        
        return success, response

    def test_subscribe_user(self):
        """Test user subscription"""
        success, response = self.run_test(
            "Subscribe User",
            "POST",
            "payment/subscribe",
            200,
            auth_required=True
        )
        
        if success:
            print(f"   Subscription message: {response.get('message', 'N/A')}")
        
        return success, response

    def test_unlimited_search_after_subscription(self):
        """Test search after subscription (should work even after limit)"""
        return self.run_test(
            "Search After Subscription",
            "POST",
            "search",
            200,
            data={"query": "test unlimited search"},
            auth_required=True
        )

    def test_guest_search(self):
        """Test guest search endpoint"""
        return self.run_test(
            "Guest Search (limited)",
            "POST",
            "search-guest",
            200,
            data={"query": "test guest search"}
        )

    def test_create_program_authenticated(self):
        """Test creating a new program (authenticated)"""
        test_program = {
            "program": "Test Program for API Testing",
            "category": "Test Category",
            "agency": "Test Agency",
            "eligibility": "Test eligibility requirements",
            "apply_url": "https://example.com/test",
            "phone": "(904) 555-0123",
            "notes": "This is a test program created by API testing",
            "source": "api_test"
        }
        
        success, response = self.run_test(
            "Create New Program (Authenticated)",
            "POST",
            "programs",
            200,
            data=test_program,
            auth_required=True
        )
        
        if success and 'id' in response:
            self.test_program_id = response['id']
            print(f"   Created program with ID: {self.test_program_id}")
        
        return success, response

    def test_delete_program_authenticated(self):
        """Test deleting a program (authenticated)"""
        if hasattr(self, 'test_program_id'):
            return self.run_test(
                "Delete Test Program (Authenticated)",
                "DELETE",
                f"programs/{self.test_program_id}",
                200,
                auth_required=True
            )
        else:
            print("⚠️  Skipping delete test - no test program ID available")
            return True, {}

def main():
    print("🚀 Starting Jacksonville Programs Finder API Tests (NEW Authentication System)")
    print("=" * 80)
    
    tester = JacksonvilleProgramsAPITester()
    
    # Test 1: Basic API health
    success, _ = tester.test_api_health()
    if not success:
        print("❌ API health check failed - stopping tests")
        return 1

    # Test 2: Initialize programs
    tester.test_init_programs()

    # Test 3: Get all programs
    success, programs = tester.test_get_all_programs()
    if not success or not programs:
        print("❌ Failed to get programs - stopping tests")
        return 1

    # Authentication Tests
    print(f"\n{'='*80}")
    print("🔐 Testing Authentication System")
    print("=" * 80)
    
    # Test 4: User registration
    success, _ = tester.test_user_registration()
    if not success:
        print("❌ User registration failed - stopping tests")
        return 1

    # Test 5: Duplicate registration (should fail)
    tester.test_duplicate_registration()

    # Test 6: User login
    success, _ = tester.test_user_login()
    if not success:
        print("❌ User login failed - stopping tests")
        return 1

    # Test 7: Invalid login (should fail)
    tester.test_invalid_login()

    # Test 8: Get current user info
    success, _ = tester.test_get_current_user()
    if not success:
        print("❌ Get current user failed - stopping tests")
        return 1

    # Test 9: Unauthorized access (should fail)
    tester.test_unauthorized_access()

    # Search Tests with Authentication
    print(f"\n{'='*80}")
    print("🔍 Testing Authenticated Search System")
    print("=" * 80)
    
    # Test 10-11: First two searches (should work)
    success1, _ = tester.test_authenticated_search("I need help with my electric bill", 1)
    success2, _ = tester.test_authenticated_search("small business facade improvement grants", 1)
    
    if not (success1 and success2):
        print("❌ Authenticated searches failed - stopping tests")
        return 1

    # Test 12: Search history
    tester.test_search_history = tester.test_get_search_history()

    # Test 13: Third search (should trigger paywall)
    tester.test_search_limit_trigger()

    # Subscription Tests
    print(f"\n{'='*80}")
    print("💳 Testing Subscription System")
    print("=" * 80)
    
    # Test 14: Subscribe user
    success, _ = tester.test_subscribe_user()
    if not success:
        print("❌ User subscription failed")
        return 1

    # Test 15: Search after subscription (should work)
    tester.test_unlimited_search_after_subscription()

    # Test 16: Get updated search history
    tester.test_get_search_history()

    # Guest Mode Tests
    print(f"\n{'='*80}")
    print("👤 Testing Guest Mode")
    print("=" * 80)
    
    # Test 17: Guest search
    tester.test_guest_search()

    # CRUD Tests with Authentication
    print(f"\n{'='*80}")
    print("📝 Testing Authenticated CRUD Operations")
    print("=" * 80)
    
    # Test 18-19: Create and delete program
    tester.test_create_program_authenticated()
    tester.test_delete_program_authenticated()

    # Final results
    print(f"\n{'='*80}")
    print("📊 TEST RESULTS SUMMARY")
    print("=" * 80)
    print(f"Tests passed: {tester.tests_passed}/{tester.tests_run}")
    
    if tester.tests_passed == tester.tests_run:
        print("🎉 All tests passed!")
        return 0
    else:
        failed = tester.tests_run - tester.tests_passed
        print(f"⚠️  {failed} test(s) failed")
        
        # Show critical failures
        if tester.tests_passed < tester.tests_run * 0.5:
            print("❌ More than 50% of tests failed - major issues detected")
            return 2
        else:
            print("⚠️  Some tests failed but core functionality may be working")
            return 1

if __name__ == "__main__":
    sys.exit(main())