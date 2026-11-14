from __future__ import annotations

from datetime import date
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.enums import ActionItemStatus


class ActionItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    description: str
    owner: str | None
    due_date: date | None
    status: ActionItemStatus


class DecisionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    description: str


class TopicOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str


class EnrichmentOut(BaseModel):
    action_items: list[ActionItemOut] = Field(default_factory=list)
    decisions: list[DecisionOut] = Field(default_factory=list)
    topics: list[TopicOut] = Field(default_factory=list)
