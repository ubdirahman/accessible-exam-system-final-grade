
import urllib.request
import json
import time

BASE_URL = "http://localhost:8000/ml/process-voice-command"

test_cases = [
    # Login
    {"text": "My ID is 2024001", "expected_intent": "LOGIN_ID", "expected_data": {"studentId": "2024001"}},
    {"text": "Login with student ID 55555", "expected_intent": "LOGIN_ID", "expected_data": {"studentId": "55555"}},

    # Exam Code
    {"text": "My exam code is 1 2 3 4 5 6", "expected_intent": "EXAM_CODE", "expected_data": {"examCode": "123456"}},
    {"text": "Enter exam code 987654", "expected_intent": "EXAM_CODE", "expected_data": {"examCode": "987654"}},

    # Navigation
    {"text": "Next question", "expected_intent": "NEXT_QUESTION"},
    {"text": "Go back", "expected_intent": "PREVIOUS_QUESTION"},
    {"text": "Skip this question", "expected_intent": "SKIP_QUESTION"},
    {"text": "Where am I?", "expected_intent": "WHERE_AM_I"},

    # MCQ Answer
    {"text": "My answer is B", "expected_intent": "ANSWER_MCQ", "expected_data": {"option": "B"}},
    {"text": "I choose option C", "expected_intent": "ANSWER_MCQ", "expected_data": {"option": "C"}},

    # Open Answer
    {"text": "My answer is the powerhouse of the cell", "expected_intent": "ANSWER_OPEN", "expected_data": {"answerText": "The powerhouse of the cell"}},
    
    # Ambiguity Check (Short answer -> MCQ?)
    {"text": "Answer is A", "expected_intent": "ANSWER_MCQ", "expected_data": {"option": "A"}},

    # Confirmation
    {"text": "Yes", "expected_intent": "CONFIRM"},
    {"text": "No", "expected_intent": "CANCEL"},
    
    # Finish
    {"text": "Finish exam", "expected_intent": "FINISH_EXAM"},
]

def run_tests():
    print(f"Testing Voice Agent at {BASE_URL}...\n")
    passed = 0
    failed = 0

    for i, case in enumerate(test_cases):
        text = case["text"]
        print(f"[{i+1}] Sending: '{text}'")
        
        try:
            req = urllib.request.Request(
                BASE_URL, 
                data=json.dumps({"text": text}).encode('utf-8'),
                headers={'Content-Type': 'application/json'}
            )
            
            with urllib.request.urlopen(req, timeout=2) as response:
                if response.status != 200:
                    print(f"  FAILED: Status {response.status}")
                    failed += 1
                    continue
                
                data = json.loads(response.read().decode('utf-8'))
                intent = data.get("intent")
            
            # Verify Intent
            if intent != case["expected_intent"]:
                print(f"  FAILED: Expected intent {case['expected_intent']}, got {intent}")
                failed += 1
                continue
            
            # Verify Data
            data_match = True
            if "expected_data" in case:
                for k, v in case["expected_data"].items():
                    if data.get(k) != v:
                        print(f"  FAILED: Expected {k}={v}, got {data.get(k)}")
                        data_match = False
                        break
            
            if data_match:
                print(f"  PASSED: Intent={intent} Check={case.get('expected_data', 'OK')}")
                passed += 1
            else:
                failed += 1

        except Exception as e:
            print(f"  ERROR: {e}")
            failed += 1
        
        print("-" * 30)

    print(f"\nCompleted. Passed: {passed}, Failed: {failed}")

if __name__ == "__main__":
    run_tests()
