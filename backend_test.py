import requests
import sys
import json
from datetime import datetime

class JacksonvilleProgramsAPITester:
    def __init__(self, base_url="https://help-jacksonville.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.session_id = f"test_session_{datetime.now().strftime('%H%M%S')}"
        self.tests_run = 0
        self.tests_passed = 0

    def run_test(self, name, method, endpoint, expected_status, data=None, params=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
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
        """Test getting all programs"""
        success, response = self.run_test("Get All Programs", "GET", "programs", 200)
        if success and isinstance(response, list):
            print(f"   Found {len(response)} programs")
            if len(response) > 0:
                print(f"   Sample program: {response[0].get('program', 'N/A')}")
        return success, response

    def test_session_info(self):
        """Test getting session information"""
        return self.run_test("Get Session Info", "GET", f"session/{self.session_id}", 200)

    def test_ai_search(self, query, expected_programs_min=1):
        """Test AI-powered search"""
        success, response = self.run_test(
            f"AI Search: '{query}'",
            "POST",
            "search",
            200,
            data={"query": query},
            params={"session_id": self.session_id}
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

    def test_paywall_trigger(self):
        """Test paywall after 2 searches"""
        print(f"\n🔍 Testing Paywall (3rd search should trigger 402)...")
        success, response = self.run_test(
            "Paywall Trigger (3rd search)",
            "POST",
            "search",
            402,  # Expecting paywall error
            data={"query": "test paywall"},
            params={"session_id": self.session_id}
        )
        return success, response

    def test_mock_payment(self):
        """Test mock payment success"""
        return self.run_test(
            "Mock Payment Success",
            "POST",
            f"payment/mock-success/{self.session_id}",
            200
        )

    def test_unlimited_search_after_payment(self):
        """Test search after payment (should work)"""
        return self.run_test(
            "Search After Payment",
            "POST",
            "search",
            200,
            data={"query": "test after payment"},
            params={"session_id": self.session_id}
        )

    def test_create_program(self):
        """Test creating a new program"""
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
            "Create New Program",
            "POST",
            "programs",
            200,
            data=test_program
        )
        
        if success and 'id' in response:
            self.test_program_id = response['id']
            print(f"   Created program with ID: {self.test_program_id}")
        
        return success, response

    def test_delete_program(self):
        """Test deleting a program"""
        if hasattr(self, 'test_program_id'):
            return self.run_test(
                "Delete Test Program",
                "DELETE",
                f"programs/{self.test_program_id}",
                200
            )
        else:
            print("⚠️  Skipping delete test - no test program ID available")
            return True, {}

def main():
    print("🚀 Starting Jacksonville Programs Finder API Tests")
    print("=" * 60)
    
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

    # Test 4: Session info
    tester.test_session_info()

    # Test 5-7: AI Search tests with specific queries
    print(f"\n{'='*60}")
    print("🤖 Testing AI Search Functionality")
    print("=" * 60)
    
    # Test specific queries mentioned in the request
    tester.test_ai_search("I need help with my electric bill", 1)
    tester.test_ai_search("small business facade improvement grants", 1)
    
    # Test 8: Paywall trigger (3rd search)
    tester.test_paywall_trigger()

    # Test 9: Mock payment
    tester.test_mock_payment()

    # Test 10: Search after payment (should work)
    tester.test_unlimited_search_after_payment()

    # Test 11-12: CRUD operations
    print(f"\n{'='*60}")
    print("📝 Testing CRUD Operations")
    print("=" * 60)
    
    tester.test_create_program()
    tester.test_delete_program()

    # Final results
    print(f"\n{'='*60}")
    print("📊 TEST RESULTS SUMMARY")
    print("=" * 60)
    print(f"Tests passed: {tester.tests_passed}/{tester.tests_run}")
    
    if tester.tests_passed == tester.tests_run:
        print("🎉 All tests passed!")
        return 0
    else:
        failed = tester.tests_run - tester.tests_passed
        print(f"⚠️  {failed} test(s) failed")
        return 1

if __name__ == "__main__":
    sys.exit(main())