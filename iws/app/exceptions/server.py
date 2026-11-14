from __future__ import annotations

from app.exceptions.base import AppError


class InternalServerError(AppError):
    status_code = 500


class BadGatewayError(AppError):
    status_code = 502


class ServiceUnavailableError(AppError):
    status_code = 503


class GatewayTimeoutError(AppError):
    status_code = 504
