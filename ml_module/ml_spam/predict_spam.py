import sys
import pickle
import os

# Get absolute path of current file directory
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Build full paths
model_path = os.path.join(BASE_DIR, "spam_model.pkl")
vectorizer_path = os.path.join(BASE_DIR, "spam_vectorizer.pkl")

# Load model + vectorizer safely
model = pickle.load(open(model_path, "rb"))
vectorizer = pickle.load(open(vectorizer_path, "rb"))

# Get input text
input_text = sys.argv[1]

# Transform
input_vec = vectorizer.transform([input_text])

# Predict
prediction = model.predict(input_vec)

print(prediction[0])