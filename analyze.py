import pandas as pd
import json

def analyze_transactions(csv_file, output_json):
    # Read the CSV
    df = pd.read_csv(csv_file)
    
    # Ensure amount is numeric and date is parsed
    df['amount'] = pd.to_numeric(df['amount'], errors='coerce')
    
    # Filter Debits
    df_payments = df[df['type'].str.strip().str.lower() == 'debit'].copy()
    df_payments = df_payments.dropna(subset=['amount', 'date', 'time'])
    
    # Convert date/time into a single ISO timestamp string for easy parsing by JS
    df_payments['timestamp'] = pd.to_datetime(df_payments['date'] + ' ' + df_payments['time'])
    
    # Sort chronologically
    df_payments = df_payments.sort_values(by='timestamp')
    
    # Extract only necessary columns: amount, timestamp
    df_export = df_payments[['amount', 'timestamp']]
    
    # Convert to list of dicts
    # JS Date can easily parse ISO strings
    records = []
    for _, row in df_export.iterrows():
        records.append({
            "amount": float(row['amount']),
            "timestamp": row['timestamp'].isoformat()
        })
        
    with open(output_json, 'w') as f:
        json.dump(records, f)
        
    print(f"Exported {len(records)} raw debit transactions to {output_json}")

if __name__ == "__main__":
    csv_filename = "upi_transactions_full_year.csv"
    json_filename = "transactions.json"
    analyze_transactions(csv_filename, json_filename)
