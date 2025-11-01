#!/usr/bin/env python3
"""
Backend API Test Suite for Stok Takip Uygulaması
Tests the most critical endpoints as requested in the review.
"""

import requests
import json
import sys
from datetime import datetime
import time

# Backend URL from frontend/.env
BACKEND_URL = "https://shopflow-update.preview.emergentagent.com/api"

class BackendTester:
    def __init__(self):
        self.session = requests.Session()
        self.auth_token = None
        self.test_results = []
        
    def log_result(self, test_name, success, message, details=None):
        """Log test result"""
        result = {
            "test": test_name,
            "success": success,
            "message": message,
            "details": details,
            "timestamp": datetime.now().isoformat()
        }
        self.test_results.append(result)
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}: {message}")
        if details:
            print(f"   Details: {details}")
    
    def test_currency_api(self):
        """Test Currency API - MOST IMPORTANT"""
        print("\n=== Testing Currency API (EN ÖNEMLİ) ===")
        
        try:
            response = self.session.get(f"{BACKEND_URL}/currency", timeout=10)
            
            if response.status_code != 200:
                self.log_result("Currency API Status", False, 
                              f"Expected 200, got {response.status_code}", response.text)
                return False
            
            try:
                data = response.json()
            except json.JSONDecodeError as e:
                self.log_result("Currency API JSON", False, 
                              "Invalid JSON response", str(e))
                return False
            
            # Check required fields
            required_fields = ["usd_try", "eur_try", "gold_try", "silver_try", "timestamp"]
            missing_fields = [field for field in required_fields if field not in data]
            
            if missing_fields:
                self.log_result("Currency API Fields", False, 
                              f"Missing required fields: {missing_fields}", data)
                return False
            
            # Check if all values are numeric
            non_numeric = []
            for field in ["usd_try", "eur_try", "gold_try", "silver_try"]:
                if not isinstance(data[field], (int, float)):
                    non_numeric.append(field)
            
            if non_numeric:
                self.log_result("Currency API Numeric", False, 
                              f"Non-numeric values: {non_numeric}", data)
                return False
            
            # Check USD and EUR ranges (30-50 as specified)
            usd_val = data["usd_try"]
            eur_val = data["eur_try"]
            
            range_issues = []
            if not (30 <= usd_val <= 50):
                range_issues.append(f"USD: {usd_val} (expected 30-50)")
            if not (30 <= eur_val <= 50):
                range_issues.append(f"EUR: {eur_val} (expected 30-50)")
            
            if range_issues:
                self.log_result("Currency API Ranges", False, 
                              f"Values outside expected range: {range_issues}", data)
                return False
            
            self.log_result("Currency API", True, 
                          f"All checks passed. USD: {usd_val}, EUR: {eur_val}, Gold: {data['gold_try']}, Silver: {data['silver_try']}")
            return True
            
        except requests.exceptions.RequestException as e:
            self.log_result("Currency API Connection", False, 
                          f"Connection error: {str(e)}")
            return False
    
    def test_auth_register(self):
        """Test user registration"""
        print("\n=== Testing Auth Registration ===")
        
        # Test data - using realistic data as instructed
        test_user = {
            "username": f"testuser_{int(time.time())}",
            "password": "SecurePass123!",
            "role": "depo"
            # email is optional as specified
        }
        
        try:
            response = self.session.post(
                f"{BACKEND_URL}/auth/register",
                json=test_user,
                timeout=10
            )
            
            if response.status_code != 200:
                self.log_result("Auth Register Status", False, 
                              f"Expected 200, got {response.status_code}", response.text)
                return False, None
            
            try:
                data = response.json()
            except json.JSONDecodeError as e:
                self.log_result("Auth Register JSON", False, 
                              "Invalid JSON response", str(e))
                return False, None
            
            # Check if user object is returned
            required_fields = ["id", "username", "role", "created_at"]
            missing_fields = [field for field in required_fields if field not in data]
            
            if missing_fields:
                self.log_result("Auth Register Fields", False, 
                              f"Missing fields in response: {missing_fields}", data)
                return False, None
            
            self.log_result("Auth Register", True, 
                          f"User created successfully: {data['username']}")
            return True, test_user
            
        except requests.exceptions.RequestException as e:
            self.log_result("Auth Register Connection", False, 
                          f"Connection error: {str(e)}")
            return False, None
    
    def test_auth_login(self, user_credentials):
        """Test user login"""
        print("\n=== Testing Auth Login ===")
        
        if not user_credentials:
            self.log_result("Auth Login", False, "No user credentials available")
            return False
        
        login_data = {
            "username": user_credentials["username"],
            "password": user_credentials["password"]
        }
        
        try:
            response = self.session.post(
                f"{BACKEND_URL}/auth/login",
                json=login_data,
                timeout=10
            )
            
            if response.status_code != 200:
                self.log_result("Auth Login Status", False, 
                              f"Expected 200, got {response.status_code}", response.text)
                return False
            
            try:
                data = response.json()
            except json.JSONDecodeError as e:
                self.log_result("Auth Login JSON", False, 
                              "Invalid JSON response", str(e))
                return False
            
            # Check token response
            required_fields = ["access_token", "token_type", "user"]
            missing_fields = [field for field in required_fields if field not in data]
            
            if missing_fields:
                self.log_result("Auth Login Fields", False, 
                              f"Missing fields in response: {missing_fields}", data)
                return False
            
            # Store token for authenticated requests
            self.auth_token = data["access_token"]
            self.session.headers.update({"Authorization": f"Bearer {self.auth_token}"})
            
            self.log_result("Auth Login", True, 
                          f"Login successful for user: {data['user']['username']}")
            return True
            
        except requests.exceptions.RequestException as e:
            self.log_result("Auth Login Connection", False, 
                          f"Connection error: {str(e)}")
            return False
    
    def test_products_endpoint(self):
        """Test products listing (requires auth)"""
        print("\n=== Testing Products Endpoint ===")
        
        if not self.auth_token:
            self.log_result("Products Auth", False, "No authentication token available")
            return False
        
        try:
            response = self.session.get(f"{BACKEND_URL}/products", timeout=10)
            
            if response.status_code != 200:
                self.log_result("Products Status", False, 
                              f"Expected 200, got {response.status_code}", response.text)
                return False
            
            try:
                data = response.json()
            except json.JSONDecodeError as e:
                self.log_result("Products JSON", False, 
                              "Invalid JSON response", str(e))
                return False
            
            # Should return a list (even if empty)
            if not isinstance(data, list):
                self.log_result("Products Format", False, 
                              f"Expected list, got {type(data)}", data)
                return False
            
            self.log_result("Products", True, 
                          f"Products endpoint working. Returned {len(data)} products")
            return True
            
        except requests.exceptions.RequestException as e:
            self.log_result("Products Connection", False, 
                          f"Connection error: {str(e)}")
            return False
    
    def test_dashboard_endpoint(self):
        """Test dashboard stats (requires auth)"""
        print("\n=== Testing Dashboard Endpoint ===")
        
        if not self.auth_token:
            self.log_result("Dashboard Auth", False, "No authentication token available")
            return False
        
        try:
            response = self.session.get(f"{BACKEND_URL}/reports/dashboard", timeout=10)
            
            if response.status_code != 200:
                self.log_result("Dashboard Status", False, 
                              f"Expected 200, got {response.status_code}", response.text)
                return False
            
            try:
                data = response.json()
            except json.JSONDecodeError as e:
                self.log_result("Dashboard JSON", False, 
                              "Invalid JSON response", str(e))
                return False
            
            # Check expected dashboard fields
            expected_fields = ["total_products", "low_stock_count", "today_sales_count", 
                             "today_revenue", "week_sales_count", "week_revenue"]
            missing_fields = [field for field in expected_fields if field not in data]
            
            if missing_fields:
                self.log_result("Dashboard Fields", False, 
                              f"Missing dashboard fields: {missing_fields}", data)
                return False
            
            # Check if numeric values
            non_numeric = []
            for field in expected_fields:
                if not isinstance(data[field], (int, float)):
                    non_numeric.append(field)
            
            if non_numeric:
                self.log_result("Dashboard Numeric", False, 
                              f"Non-numeric dashboard values: {non_numeric}", data)
                return False
            
            self.log_result("Dashboard", True, 
                          f"Dashboard stats working. Products: {data['total_products']}, Low stock: {data['low_stock_count']}")
            return True
            
        except requests.exceptions.RequestException as e:
            self.log_result("Dashboard Connection", False, 
                          f"Connection error: {str(e)}")
            return False

    def create_admin_user(self):
        """Create an admin user for testing admin-only features"""
        print("\n=== Creating Admin User ===")
        
        admin_user = {
            "username": f"admin_{int(time.time())}",
            "password": "AdminPass123!",
            "role": "yönetici"
        }
        
        try:
            response = self.session.post(
                f"{BACKEND_URL}/auth/register",
                json=admin_user,
                timeout=10
            )
            
            if response.status_code != 200:
                self.log_result("Admin User Creation", False, 
                              f"Expected 200, got {response.status_code}", response.text)
                return False, None
            
            self.log_result("Admin User Creation", True, 
                          f"Admin user created: {admin_user['username']}")
            return True, admin_user
            
        except requests.exceptions.RequestException as e:
            self.log_result("Admin User Creation", False, 
                          f"Connection error: {str(e)}")
            return False, None

    def login_as_admin(self, admin_credentials):
        """Login as admin user"""
        print("\n=== Admin Login ===")
        
        if not admin_credentials:
            self.log_result("Admin Login", False, "No admin credentials available")
            return False, None
        
        login_data = {
            "username": admin_credentials["username"],
            "password": admin_credentials["password"]
        }
        
        try:
            response = self.session.post(
                f"{BACKEND_URL}/auth/login",
                json=login_data,
                timeout=10
            )
            
            if response.status_code != 200:
                self.log_result("Admin Login Status", False, 
                              f"Expected 200, got {response.status_code}", response.text)
                return False, None
            
            data = response.json()
            admin_token = data["access_token"]
            
            self.log_result("Admin Login", True, 
                          f"Admin login successful: {data['user']['username']}")
            return True, admin_token
            
        except requests.exceptions.RequestException as e:
            self.log_result("Admin Login Connection", False, 
                          f"Connection error: {str(e)}")
            return False, None

    def test_customer_soft_delete(self):
        """Test Customer Soft Delete functionality"""
        print("\n=== Testing Customer Soft Delete ===")
        
        if not self.auth_token:
            self.log_result("Customer Delete Auth", False, "No authentication token available")
            return False
        
        # Step 1: Create a test customer
        customer_data = {
            "name": "Ahmet Yılmaz",
            "phone": "05551234567",
            "email": "ahmet@example.com",
            "notes": "Test müşterisi"
        }
        
        try:
            # Create customer
            response = self.session.post(
                f"{BACKEND_URL}/customers",
                json=customer_data,
                timeout=10
            )
            
            if response.status_code != 200:
                self.log_result("Customer Creation", False, 
                              f"Expected 200, got {response.status_code}", response.text)
                return False
            
            customer = response.json()
            customer_id = customer["id"]
            
            self.log_result("Customer Creation", True, 
                          f"Customer created: {customer['name']} (ID: {customer_id})")
            
            # Step 2: Try to delete with non-admin user (should fail with 403)
            delete_response = self.session.delete(
                f"{BACKEND_URL}/customers/{customer_id}",
                timeout=10
            )
            
            if delete_response.status_code != 403:
                self.log_result("Customer Delete Non-Admin", False, 
                              f"Expected 403, got {delete_response.status_code}", delete_response.text)
                return False
            
            self.log_result("Customer Delete Non-Admin", True, 
                          "Non-admin user correctly denied access (403)")
            
            # Step 3: Create admin user and login
            admin_success, admin_creds = self.create_admin_user()
            if not admin_success:
                return False
            
            login_success, admin_token = self.login_as_admin(admin_creds)
            if not login_success:
                return False
            
            # Step 4: Delete customer as admin
            admin_headers = {"Authorization": f"Bearer {admin_token}"}
            admin_delete_response = self.session.delete(
                f"{BACKEND_URL}/customers/{customer_id}",
                headers=admin_headers,
                timeout=10
            )
            
            if admin_delete_response.status_code != 200:
                self.log_result("Customer Delete Admin", False, 
                              f"Expected 200, got {admin_delete_response.status_code}", admin_delete_response.text)
                return False
            
            self.log_result("Customer Delete Admin", True, 
                          "Admin successfully deleted customer (200)")
            
            # Step 5: Verify customer is not in GET /customers list
            customers_response = self.session.get(f"{BACKEND_URL}/customers", timeout=10)
            
            if customers_response.status_code != 200:
                self.log_result("Customer List Check", False, 
                              f"Expected 200, got {customers_response.status_code}", customers_response.text)
                return False
            
            customers_list = customers_response.json()
            deleted_customer_found = any(c["id"] == customer_id for c in customers_list)
            
            if deleted_customer_found:
                self.log_result("Customer Soft Delete Verification", False, 
                              "Deleted customer still appears in customer list")
                return False
            
            self.log_result("Customer Soft Delete Verification", True, 
                          "Deleted customer correctly filtered out from customer list")
            
            self.log_result("Customer Soft Delete", True, 
                          "All customer soft delete tests passed")
            return True
            
        except requests.exceptions.RequestException as e:
            self.log_result("Customer Soft Delete Connection", False, 
                          f"Connection error: {str(e)}")
            return False

    def test_product_price_comparison(self):
        """Test Product Price Comparison endpoint"""
        print("\n=== Testing Product Price Comparison ===")
        
        if not self.auth_token:
            self.log_result("Price Comparison Auth", False, "No authentication token available")
            return False
        
        # Step 1: Create a test product
        product_data = {
            "name": "Aspirin 500mg",
            "barcode": f"123456789{int(time.time())}",
            "quantity": 100,
            "min_quantity": 10,
            "brand": "Bayer",
            "category": "İlaç",
            "purchase_price": 15.50,
            "sale_price": 25.00,
            "description": "Ağrı kesici ilaç"
        }
        
        try:
            # Create product
            response = self.session.post(
                f"{BACKEND_URL}/products",
                json=product_data,
                timeout=10
            )
            
            if response.status_code != 200:
                self.log_result("Product Creation", False, 
                              f"Expected 200, got {response.status_code}", response.text)
                return False
            
            product = response.json()
            product_id = product["id"]
            
            self.log_result("Product Creation", True, 
                          f"Product created: {product['name']} (ID: {product_id})")
            
            # Step 2: Call price comparison endpoint
            comparison_response = self.session.get(
                f"{BACKEND_URL}/products/{product_id}/price-comparison",
                timeout=10
            )
            
            if comparison_response.status_code != 200:
                self.log_result("Price Comparison Status", False, 
                              f"Expected 200, got {comparison_response.status_code}", comparison_response.text)
                return False
            
            try:
                comparison_data = comparison_response.json()
            except json.JSONDecodeError as e:
                self.log_result("Price Comparison JSON", False, 
                              "Invalid JSON response", str(e))
                return False
            
            # Step 3: Verify required fields in response
            required_fields = ["product_id", "product_name", "brand", "category", "current_price", "barcode"]
            missing_fields = [field for field in required_fields if field not in comparison_data]
            
            if missing_fields:
                self.log_result("Price Comparison Fields", False, 
                              f"Missing required fields: {missing_fields}", comparison_data)
                return False
            
            # Step 4: Verify data correctness
            data_issues = []
            if comparison_data["product_id"] != product_id:
                data_issues.append(f"product_id mismatch: expected {product_id}, got {comparison_data['product_id']}")
            if comparison_data["product_name"] != product_data["name"]:
                data_issues.append(f"product_name mismatch: expected {product_data['name']}, got {comparison_data['product_name']}")
            if comparison_data["brand"] != product_data["brand"]:
                data_issues.append(f"brand mismatch: expected {product_data['brand']}, got {comparison_data['brand']}")
            if comparison_data["category"] != product_data["category"]:
                data_issues.append(f"category mismatch: expected {product_data['category']}, got {comparison_data['category']}")
            if comparison_data["current_price"] != product_data["sale_price"]:
                data_issues.append(f"current_price mismatch: expected {product_data['sale_price']}, got {comparison_data['current_price']}")
            if comparison_data["barcode"] != product_data["barcode"]:
                data_issues.append(f"barcode mismatch: expected {product_data['barcode']}, got {comparison_data['barcode']}")
            
            if data_issues:
                self.log_result("Price Comparison Data", False, 
                              f"Data validation issues: {data_issues}", comparison_data)
                return False
            
            self.log_result("Price Comparison", True, 
                          f"Price comparison endpoint working correctly. Product: {comparison_data['product_name']}, Price: {comparison_data['current_price']}")
            return True
            
        except requests.exceptions.RequestException as e:
            self.log_result("Price Comparison Connection", False, 
                          f"Connection error: {str(e)}")
            return False
    
    def run_all_tests(self):
        """Run all backend tests"""
        print(f"🚀 Starting Backend API Tests")
        print(f"Backend URL: {BACKEND_URL}")
        print("=" * 60)
        
        # Test 1: Currency API (MOST IMPORTANT)
        currency_success = self.test_currency_api()
        
        # Test 2: Auth Registration
        register_success, user_creds = self.test_auth_register()
        
        # Test 3: Auth Login
        login_success = False
        if register_success:
            login_success = self.test_auth_login(user_creds)
        
        # Test 4: Products (requires auth)
        products_success = False
        if login_success:
            products_success = self.test_products_endpoint()
        
        # Test 5: Dashboard (requires auth)
        dashboard_success = False
        if login_success:
            dashboard_success = self.test_dashboard_endpoint()
        
        # Summary
        print("\n" + "=" * 60)
        print("🏁 TEST SUMMARY")
        print("=" * 60)
        
        total_tests = len(self.test_results)
        passed_tests = sum(1 for r in self.test_results if r["success"])
        failed_tests = total_tests - passed_tests
        
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_tests}")
        print(f"Failed: {failed_tests}")
        
        if failed_tests > 0:
            print("\n❌ FAILED TESTS:")
            for result in self.test_results:
                if not result["success"]:
                    print(f"  - {result['test']}: {result['message']}")
        
        # Critical assessment
        critical_issues = []
        if not currency_success:
            critical_issues.append("Currency API (EN ÖNEMLİ) - Not working")
        
        if critical_issues:
            print(f"\n🚨 CRITICAL ISSUES:")
            for issue in critical_issues:
                print(f"  - {issue}")
            return False
        else:
            print(f"\n✅ All critical tests passed!")
            return True

def main():
    """Main test execution"""
    tester = BackendTester()
    success = tester.run_all_tests()
    
    # Return appropriate exit code
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()