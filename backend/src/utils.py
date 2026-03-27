from pathlib import Path

# The unique 41 clause types based on the prompt (removed duplicate "Governing Law")
CLAUSE_TYPES = [
    "Governing Law",
    "Parties",
    "Effective Date",
    "Expiration Date",
    "Renewal Term",
    "Notice Period to Terminate Renewal",
    "Most Favored Nation",
    "Non-Compete",
    "Exclusivity",
    "No-Solicit of Customers",
    "No-Solicit of Employees",
    "Non-Disparagement",
    "Termination for Convenience",
    "ROFR/ROFO/ROFN",
    "Change of Control",
    "Anti-Assignment",
    "Revenue/Profit Sharing",
    "Price Restrictions",
    "Minimum Commitment",
    "Volume Restriction",
    "IP Ownership Assignment",
    "Joint IP Ownership",
    "License Grant",
    "Non-Transferable License",
    "Affiliate License-Licensor",
    "Affiliate License-Licensee",
    "Unlimited/All-You-Can-Eat License",
    "Irrevocable or Perpetual License",
    "Source Code Escrow",
    "Post-Termination Services",
    "Audit Rights",
    "Uncapped Liability",
    "Cap on Liability",
    "Liquidated Damages",
    "Warranty Duration",
    "Insurance",
    "Covenant Not to Sue",
    "Third Party Beneficiary",
    "FCPA (Anti-Corruption)",
    "Consent to Jurisdiction"
]

CRITICAL_CLAUSES = [
    "Cap on Liability", "Audit Rights", "Termination for Convenience",
    "Change of Control", "IP Ownership Assignment", "Anti-Assignment",
    "Insurance", "Uncapped Liability"
]

DATA_DIR = Path(__file__).parent.parent / "data"
RESULTS_DIR = DATA_DIR / "results"
CONTRACTS_DIR = DATA_DIR / "contracts"
CUAD_JSON = DATA_DIR / "CUADv1.json"
