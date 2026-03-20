import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.model_selection import train_test_split
from sklearn.naive_bayes import MultinomialNB
from sklearn.metrics import classification_report
import pickle

# Load dataset
data = pd.read_csv("spam_dataset.csv")

X = data["text"]
y = data["label"]

# Convert text to numerical features
vectorizer = TfidfVectorizer()
X_vectorized = vectorizer.fit_transform(X)

# Split into training and testing
X_train, X_test, y_train, y_test = train_test_split(
    X_vectorized, y, test_size=0.2, random_state=42
)

# Train model
model = MultinomialNB()
model.fit(X_train, y_train)

# Evaluate
y_pred = model.predict(X_test)
print(classification_report(y_test, y_pred))

# Save model
pickle.dump(model, open("spam_model.pkl", "wb"))
pickle.dump(vectorizer, open("spam_vectorizer.pkl", "wb"))

print("Model saved successfully!")
while True:
    user_input = input("Enter text: ")
    vector = vectorizer.transform([user_input])
    prediction = model.predict(vector)
    print("Prediction:", prediction[0])