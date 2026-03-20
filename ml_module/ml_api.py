from flask import Flask, request, jsonify
import pickle
import os

app = Flask(__name__)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Load spam model from ml_spam folder
spam_model = pickle.load(open(os.path.join(BASE_DIR, "ml_spam", "spam_model.pkl"), "rb"))
spam_vectorizer = pickle.load(open(os.path.join(BASE_DIR, "ml_spam", "spam_vectorizer.pkl"), "rb"))

# Load urgency model from urgency folder
urgency_model = pickle.load(open(os.path.join(BASE_DIR, "urgency", "urgency_model.pkl"), "rb"))
urgency_vectorizer = pickle.load(open(os.path.join(BASE_DIR, "urgency", "urgency_vectorizer.pkl"), "rb"))

@app.route("/analyze", methods=["POST"])
def analyze():
    data = request.json
    message = data["message"]

    spam_vec = spam_vectorizer.transform([message])
    spam_pred = spam_model.predict(spam_vec)[0]

    urgency_vec = urgency_vectorizer.transform([message])
    urgency_pred = urgency_model.predict(urgency_vec)[0]

    return jsonify({
        "spam": True if spam_pred == "spam" else False,
        "urgency": str(urgency_pred)
    })

if __name__ == "__main__":
    app.run(port=5001)