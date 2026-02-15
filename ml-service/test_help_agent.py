
import urllib.request
import json
import time

BASE_URL = "http://localhost:8000/ml/help"

test_cases = [
    # 1. Anxiety / Support
    {
        "studentText": "I feel nervous about this exam",
        "questionText": "What is the capital of France?",
        "expected_substring": "breath"
    },
    # 2. Asking for answer (Forbidden)
    {
        "studentText": "What is the answer?",
        "questionText": "What is the capital of France?",
        "expected_substring": "cannot provide answers"
    },
    # 3. Explanation request (Allowed)
    {
        "studentText": "I don't understand the word 'capital'",
        "questionText": "What is the capital of France?",
        "check_mode": "HELP" 
        # We don't check exact text since it's generated, just that we got a response
    }
]

def run_tests():
    print(f"Testing Help Agent at {BASE_URL}...\n")
    passed = 0
    failed = 0

    for i, case in enumerate(test_cases):
        print(f"[{i+1}] Student: '{case['studentText']}'")
        
        payload = {
            "studentText": case["studentText"],
            "questionText": case["questionText"]
        }
        
        try:
            req = urllib.request.Request(
                BASE_URL, 
                data=json.dumps(payload).encode('utf-8'),
                headers={'Content-Type': 'application/json'}
            )
            
            # Timeout set higher for model loading/generation
            with urllib.request.urlopen(req, timeout=2) as response:
                if response.status != 200:
                    print(f"  FAILED: Status {response.status}")
                    failed += 1
                    continue
                
                data = json.loads(response.read().decode('utf-8'))
                mode = data.get("mode")
                resp_text = data.get("response", "")
                
                print(f"  -> Response: {resp_text[:100]}...")

                # Checks
                if "expected_substring" in case:
                    if case["expected_substring"].lower() not in resp_text.lower():
                        print(f"  FAILED: Expected substring '{case['expected_substring']}' not found.")
                        failed += 1
                        continue
                
                if "check_mode" in case:
                    if mode != case["check_mode"]:
                        print(f"  FAILED: Expected mode {case['check_mode']}, got {mode}")
                        failed += 1
                        continue
                
                print("  PASSED")
                passed += 1

        except Exception as e:
            print(f"  ERROR: {e}")
            failed += 1
        
        print("-" * 30)

    print(f"\nCompleted. Passed: {passed}, Failed: {failed}")

if __name__ == "__main__":
    # Wait a bit for server to start if just launched
    time.sleep(2)
    run_tests()
