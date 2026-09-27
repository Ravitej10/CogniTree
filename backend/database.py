import os
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

# Paste your Supabase URI here (with your actual password filled in)
DATABASE_URL = "postgresql+psycopg://postgres.rlwthdrjvhktpzzapyws:6gZ6gUmPFh5GNOL4@aws-0-ap-south-1.pooler.supabase.com:6543/postgres"

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()