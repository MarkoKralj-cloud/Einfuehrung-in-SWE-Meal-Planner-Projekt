import csv


def read_foods(csv_path: str) -> list[dict]:
    """Liest die Lebensmittel aus der Beispiel-CSV-Datei ein."""
    foods = []

    with open(csv_path, encoding="utf-8", newline="") as csv_file:
        for row in csv.DictReader(csv_file):
            foods.append(
                {
                    "food_id": row["food_id"],
                    "name": row["name"],
                    "kcal_per_100g": int(row["kcal_per_100g"]),
                    "carbs_g": float(row["carbs_g"]),
                    "protein_g": float(row["protein_g"]),
                    "fat_g": float(row["fat_g"]),
                    "food_type": row["food_type"],
                    "allergens": row["allergens"],
                }
            )

    return foods
