import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import classification_report
import pickle

# Load data
data = pd.read_csv("urgency_data.csv")

X = data["text"]
y = data["urgency"]

# Split data
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42, stratify=y
)

# Convert text to numeric vectors
vectorizer = TfidfVectorizer(ngram_range=(1,2))
X_train_vec = vectorizer.fit_transform(X_train)
X_test_vec = vectorizer.transform(X_test)

# Train model
model = LogisticRegression(max_iter=500)
model.fit(X_train_vec, y_train)

# Test model
predictions = model.predict(X_test_vec)

print("\nModel Evaluation:\n")
print(classification_report(y_test, predictions))

# Save model + vectorizer
pickle.dump(model, open("urgency_model.pkl", "wb"))
pickle.dump(vectorizer, open("urgency_vectorizer.pkl", "wb"))

print("\nUrgency model saved successfully!")