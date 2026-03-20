import sys
import pickle

# Load saved model
model = pickle.load(open("urgency_model.pkl", "rb"))
vectorizer = pickle.load(open("urgency_vectorizer.pkl", "rb"))

# Take input from command line
input_text = sys.argv[1]

# Convert text
input_vec = vectorizer.transform([input_text])

# Predict urgency
prediction = model.predict(input_vec)

print(prediction[0])