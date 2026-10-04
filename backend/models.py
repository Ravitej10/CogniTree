import enum
from sqlalchemy import (
    Column, Integer, String, Boolean, Float, ForeignKey, 
    DateTime, Text, JSON, Enum
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from backend.database import Base


class SkillType(str, enum.Enum):
    MEMORIZATION = "memorization"
    APPLICATION = "application"


class DocumentStatus(str, enum.Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    READY = "ready"
    FAILED = "failed"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    documents = relationship("SourceDocument", back_populates="user")
    sessions = relationship("QuizSession", back_populates="user")


class SourceDocument(Base):
    __tablename__ = "source_documents"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    filename = Column(String, nullable=False)
    chunk_count = Column(Integer, default=0)
    status = Column(Enum(DocumentStatus), default=DocumentStatus.PENDING)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="documents")


class ConceptTag(Base):
    __tablename__ = "concept_tags"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    normalized_name = Column(String, index=True, nullable=False)
    definition = Column(Text, nullable=True)
    subject = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    aliases = relationship("TagAlias", back_populates="tag", cascade="all, delete-orphan")


class TagAlias(Base):
    __tablename__ = "tag_aliases"

    id = Column(Integer, primary_key=True, index=True)
    tag_id = Column(Integer, ForeignKey("concept_tags.id"), nullable=False)
    alias = Column(String, nullable=False)
    normalized_alias = Column(String, index=True, nullable=False)

    tag = relationship("ConceptTag", back_populates="aliases")


class Question(Base):
    __tablename__ = "questions"

    id = Column(Integer, primary_key=True, index=True)
    question_text = Column(Text, nullable=False)
    option_a = Column(String, nullable=False)
    option_b = Column(String, nullable=False)
    option_c = Column(String, nullable=False)
    option_d = Column(String, nullable=False)
    correct_answer = Column(String, nullable=False)
    topic = Column(String, nullable=False)
    concept = Column(String, nullable=False)
    skill_type = Column(String, nullable=False)

    @property
    def options(self):
        return [self.option_a, self.option_b, self.option_c, self.option_d]

    @property
    def subtopic(self):
        return self.concept

    @property
    def answer_index(self):
        opts = self.options
        if self.correct_answer in opts:
            return opts.index(self.correct_answer)
        key = str(self.correct_answer).strip().upper()
        if key in ("A", "OPTION_A", "OPTION A"):
            return 0
        if key in ("B", "OPTION_B", "OPTION B"):
            return 1
        if key in ("C", "OPTION_C", "OPTION C"):
            return 2
        if key in ("D", "OPTION_D", "OPTION D"):
            return 3
        return 0

    @property
    def explanation(self):
        return f"The correct answer is '{self.correct_answer}' for {self.concept}."


class QuizSession(Base):
    __tablename__ = "quiz_sessions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    score = Column(Float, default=0.0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="sessions")
    responses = relationship("Response", back_populates="session")


class Response(Base):
    __tablename__ = "responses"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("quiz_sessions.id"), nullable=False)
    question_id = Column(Integer, ForeignKey("questions.id"), nullable=False)
    selected_index = Column(Integer, nullable=False)
    is_correct = Column(Boolean, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    session = relationship("QuizSession", back_populates="responses")
    question = relationship("Question")