"""
Accessible Exam System — ML Grading Service
Grades open-ended answers using sentence-transformers cosine similarity.
"""

import os
import logging
from flask import Flask, request, jsonify
from flask_cors import CORS

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

# ─── Model Loading ───────────────────────────────────────────────────────────
model = None

def get_model():
    """Lazy-load the sentence-transformers model."""
    global model
    if model is None:
        try:
            from sentence_transformers import SentenceTransformer
            model_name = os.environ.get('MODEL_NAME', 'all-MiniLM-L6-v2')
            logger.info(f"Loading model: {model_name}")
            model = SentenceTransformer(model_name)
            logger.info("Model loaded successfully")
        except Exception as e:
            logger.error(f"Error loading model: {e}")
            model = None
    return model


def compute_similarity(text1, text2):
    """Compute cosine similarity between two texts."""
    m = get_model()
    if m is None:
        # Fallback: simple keyword overlap
        return keyword_similarity(text1, text2)

    from sentence_transformers import util
    embeddings = m.encode([text1, text2], convert_to_tensor=True)
    similarity = util.cos_sim(embeddings[0], embeddings[1]).item()
    return max(0, min(1, similarity))


def keyword_similarity(text1, text2):
    """Fallback: simple keyword overlap ratio."""
    words1 = set(text1.lower().split())
    words2 = set(text2.lower().split())
    if not words1 or not words2:
        return 0.0
    intersection = words1 & words2
    union = words1 | words2
    return len(intersection) / len(union)


def generate_feedback(score, student_answer, reference_answer):
    """Generate feedback based on similarity score."""
    if score >= 90:
        return "Excellent answer! Your response closely matches the expected answer with comprehensive coverage."
    elif score >= 75:
        return "Good answer. You covered most key points. Consider elaborating on some concepts for a more complete response."
    elif score >= 50:
        return "Satisfactory answer. You addressed some key points but missed important aspects. Review the topic for better understanding."
    elif score >= 25:
        return "Below average. Your answer only partially addresses the question. Significant key concepts are missing."
    else:
        return "Your answer does not sufficiently address the question. Please review the material and try to cover the main concepts."


# ─── Routes ──────────────────────────────────────────────────────────────────

@app.route('/ml/grade-open-ended', methods=['POST'])
def grade_open_ended():
    """
    Grade an open-ended answer using semantic similarity.

    Request body:
      - questionId: str
      - studentAnswer: str
      - referenceAnswer: str

    Response:
      - score: int (0-100)
      - feedback: str
    """
    try:
        data = request.get_json()

        if not data:
            return jsonify({'error': 'No JSON data provided'}), 400

        student_answer = data.get('studentAnswer', '').strip()
        reference_answer = data.get('referenceAnswer', '').strip()
        question_id = data.get('questionId', '')

        if not student_answer:
            return jsonify({
                'score': 0,
                'feedback': 'No answer provided.',
                'questionId': question_id
            })

        if not reference_answer:
            return jsonify({
                'score': 0,
                'feedback': 'No reference answer available for grading.',
                'questionId': question_id
            })

        # Compute similarity
        similarity = compute_similarity(student_answer, reference_answer)
        score = round(similarity * 100)

        # Clamp score
        score = max(0, min(100, score))

        # Generate feedback
        feedback = generate_feedback(score, student_answer, reference_answer)

        logger.info(f"Graded question {question_id}: score={score}")

        return jsonify({
            'score': score,
            'feedback': feedback,
            'questionId': question_id
        })

    except Exception as e:
        logger.error(f"Grading error: {e}")
        return jsonify({
            'error': str(e),
            'score': 0,
            'feedback': 'An error occurred during grading.'
        }), 500


# ─── Voice Command Agent ─────────────────────────────────────────────────────

import re

class VoiceCommandAgent:
    """
    Handles voice command processing for the exam system.
    Identifies intents using semantic similarity and extracts entities using regex.
    """

    INTENT_ANCHORS = {
        "LOGIN_ID": [
            "My ID is 2024001",
            "Login with student ID",
            "Here is my student number",
            "My student identifier is",
            "I want to login with my ID"
        ],
        "EXAM_CODE": [
            "My exam code is 123456",
            "Enter exam code",
            "The code for the exam is",
            "I have an exam code",
            "Start exam with code"
        ],
        "ENTER_EXAM": [
            "Enter exam",
            "Go into the exam",
            "Open the exam environment"
        ],
        "START_EXAM": [
            "Start the exam",
            "Begin the test",
            "I am ready to start"
        ],
        "GO_TO_SECTION": [
            "Go to section",
            "Switch to section",
            "Navigate to part"
        ],
        "NEXT_QUESTION": [
            "Next question",
            "Go to the next one",
            "Skip to next",
            "Move forward"
        ],
        "PREVIOUS_QUESTION": [
            "Previous question",
            "Go back",
            "Return to the last one",
            "Move backward"
        ],
        "REPEAT_QUESTION": [
            "Repeat the question",
            "Read it again",
            "Say that again",
            "What was the question?"
        ],
        "SKIP_QUESTION": [
            "Skip this question",
            "Leave it for later",
            "I don't know this one, skip"
        ],
        "ANSWER_MCQ": [
            "My answer is B",
            "Option C",
            "I choose A",
            "Select answer D",
            "Mark option B"
        ],
        "ANSWER_OPEN": [
            "My answer is",
            "The answer is",
            "I think the answer is",
            "Write this down"
        ],
        "CONFIRM": [
            "Yes",
            "Confirm",
            "That is correct",
            "Go ahead"
        ],
        "CANCEL": [
            "No",
            "Cancel",
            "That is wrong",
            "Stop"
        ],
        "HOW_MANY_REMAINING": [
            "How many questions act left?",
            "What is remaining?",
            "How much more to do?"
        ],
        "WHERE_AM_I": [
            "Where am I?",
            "What question is this?",
            "Current status"
        ],
        "GO_TO_UNANSWERED": [
            "Go to unanswered questions",
            "Navigate to skipped ones",
            "Show me what I missed"
        ],
        "FINISH_EXAM": [
            "Finish exam",
            "Submit the test",
            "I am done",
            "End the exam"
        ]
    }

    def __init__(self):
        self.model = get_model()

    def identify_intent(self, text):
        """Identifies the intent of the user's spoken text."""
        if not text:
            return None, 0.0

        best_intent = None
        best_score = -1.0

        for intent, anchors in self.INTENT_ANCHORS.items():
            # Check for direct keyword overlap first (fast path)
            for anchor in anchors:
                if anchor.lower() in text.lower():
                     # Give a small boost if direct phrase match
                    score = 0.8
                    if score > best_score:
                        best_score = score
                        best_intent = intent
            
            # Semantic similarity check
            if self.model:
                 # Encode user text
                user_emb = self.model.encode(text, convert_to_tensor=True)
                # Encode anchors
                anchor_embs = self.model.encode(anchors, convert_to_tensor=True)
                
                from sentence_transformers import util
                # Compute cosine similarities
                scores = util.cos_sim(user_emb, anchor_embs)[0]
                # Get max score for this intent
                max_score = float(scores.max())
                
                if max_score > best_score:
                    best_score = max_score
                    best_intent = intent
        
        return best_intent, best_score

    def extract_entities(self, text, intent):
        """
        Extracts entities based on the identified intent.
        Returns a dictionary of extracted data.
        """
        data = {}

        if intent == "LOGIN_ID":
            # Extract sequence of digits
            match = re.search(r'\b(\d+)\b', text)
            if match:
                data["studentId"] = match.group(1)
            else:
                 # Fallback: try to convert words to numbers if needed, 
                 # but for now assume digits are spoken clearly or STT handles it.
                 pass

        elif intent == "EXAM_CODE":
            # Extract sequence of digits, allowing for spaces (e.g. "1 2 3 4 5 6")
            # Remove spaces to form the code
            cleaned = text.replace(" ", "")
            match = re.search(r'(\d+)', cleaned)
            if match:
                 data["examCode"] = match.group(0)

        elif intent == "ANSWER_MCQ":
            # Extract single letter option (A, B, C, D, or E)
            # Look for "Option X", "Answer X", "Choose X", or just "X" if it's clear
            match = re.search(r'\b([A-E])\b', text.upper())
            if match:
                data["option"] = match.group(1)
            else:
                 # Try to find "Option [Word]" or similar if STT spells out letters?
                 # For now, simplistic regex.
                 pass

        elif intent == "ANSWER_OPEN":
            # Capture the whole text as the answer, potentially preserving case
            # We might want to strip the "My answer is" prefix if present
            prefixes = ["my answer is", "the answer is", "answer is", "i think"]
            lower_text = text.lower()
            start_index = 0
            for prefix in prefixes:
                if lower_text.startswith(prefix):
                    start_index = len(prefix)
                    break
            
            data["answerText"] = text[start_index:].strip().capitalize()
            if not data["answerText"]:
                 # If the user just said "My answer is", take the whole thing or fail?
                 # Let's keep the full text if stripping results in empty
                 data["answerText"] = text

        return data

    def process(self, text):
        """Process a voice command and return the structured response."""
        intent, score = self.identify_intent(text)
        
        logger.info(f"Processed: '{text}' -> Intent: {intent} (Score: {score:.2f})")

        # Threshold for confidence
        if score < 0.3 or not intent:
             return {
                 "intent": None,
                 "message": "I did not understand. Please repeat."
             }

        # Intent specific overrides for specialized logic
        # e.g. "My answer is B" vs "My answer is ..." (Open vs MCQ)
        # Verify ambiguity between ANSWER_MCQ and ANSWER_OPEN
        if intent == "ANSWER_OPEN":
            # If it looks like an MCQ answer, switch intent
            mcq_check = self.extract_entities(text, "ANSWER_MCQ")
            if "option" in mcq_check and len(text.split()) < 5: 
                intent = "ANSWER_MCQ"
        
        entities = self.extract_entities(text, intent)
        
        response = {"intent": intent}
        response.update(entities)
        
        return response


voice_agent = VoiceCommandAgent() # Singleton-ish

@app.route('/ml/process-voice-command', methods=['POST'])
def process_voice_command():
    """
    Process a voice command text.
    
    Request:
      - text: str
      
    Response:
      - intent: str
      - ... (entities)
      - message: str (optional spoken feedback)
    """
    try:
        data = request.get_json()
        if not data or 'text' not in data:
            return jsonify({'error': 'No text provided'}), 400
            
        text = data['text'].strip()
        result = voice_agent.process(text)
        
        return jsonify(result)

    except Exception as e:
        logger.error(f"Voice processing error: {e}")
        return jsonify({'error': str(e)}), 500


# ─── Help Assistant ──────────────────────────────────────────────────────────

class HelpAssistant:
    """
    Safe AI Help Assistant for the exam system.
    Provides explanations, definitions, and support without revealing answers.
    """
    
    def __init__(self):
        self.generator = None
        self.tokenizer = None

    def load_generator(self):
        """Lazy-load the text generation model."""
        if self.generator is None:
            try:
                from transformers import AutoTokenizer, AutoModelForSeq2SeqLM
                # Use a small, fast model
                model_name = "google/flan-t5-small" 
                logger.info(f"Loading help model: {model_name}")
                self.tokenizer = AutoTokenizer.from_pretrained(model_name)
                self.model_gen = AutoModelForSeq2SeqLM.from_pretrained(model_name)
                logger.info("Help model loaded.")
            except Exception as e:
                logger.error(f"Error loading help model: {e}")
                self.generator = None

    def generate_response(self, prompt, max_length=60):
        """Generate a text response."""
        self.load_generator()
        if not self.model_gen:
            return "I am currently unable to generate a response. Please ask a proctor."

        try:
            inputs = self.tokenizer(prompt, return_tensors="pt")
            outputs = self.model_gen.generate(**inputs, max_length=max_length)
            return self.tokenizer.decode(outputs[0], skip_special_tokens=True)
        except Exception as e:
            logger.error(f"Generation error: {e}")
            return "I encountered an error generating a response."

    def process(self, student_text, question_text):
        """
        Process a help request.
        """
        # SAFEGUARD: Detect if asking for answers
        lower_text = student_text.lower()
        forbidden_phrases = [
            "what is the answer", "tell me the answer", "is it a", "is it b",
            "is the answer", "give me the answer", "solve this", "correct option"
        ]
        
        if any(p in lower_text for p in forbidden_phrases):
             return {
                 "mode": "HELP",
                 "response": "I cannot provide answers during the exam, but I can help explain the question or define words."
             }

        # SAFEGUARD: Anxiety detection
        anxiety_phrases = ["nervous", "scared", "failed", "panic", "anxious", "stress"]
        if any(p in lower_text for p in anxiety_phrases):
             return {
                 "mode": "HELP",
                 "response": "Take a deep breath. You are doing fine. Focus on one question at a time."
             }

        # Explanation / Definition Request
        # Construct a safe prompt for the LLM
        # We want it to explain, not solve.
        
        prompt = (
            f"Explain the following question to a student simply, without giving the answer. "
            f"Question: {question_text}. "
            f"Student asks: {student_text}"
        )
        
        response_text = self.generate_response(prompt)
        
        return {
            "mode": "HELP",
            "response": response_text
        }


help_assistant = HelpAssistant()

@app.route('/ml/help', methods=['POST'])
def help_endpoint():
    """
    Get help from the AI assistant.
    
    Request:
      - studentText: str
      - questionText: str
      
    Response:
      - mode: "HELP"
      - response: str
    """
    try:
        data = request.get_json()
        student_text = data.get('studentText', '').strip()
        question_text = data.get('questionText', '').strip()
        
        if not student_text:
            return jsonify({'response': 'How can I help you?'})
            
        result = help_assistant.process(student_text, question_text)
        return jsonify(result)

    except Exception as e:
        logger.error(f"Help processing error: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/ml/health', methods=['GET'])
def health():
    """Health check endpoint."""
    model_loaded = model is not None
    return jsonify({
        'status': 'ok',
        'model_loaded': model_loaded,
        'model_name': os.environ.get('MODEL_NAME', 'all-MiniLM-L6-v2')
    })


# ─── Entry Point ─────────────────────────────────────────────────────────────

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8000))
    logger.info(f"Starting ML service on port {port}")

    # Pre-load model
    get_model()
    help_assistant.load_generator()

    app.run(host='0.0.0.0', port=port, debug=False)
