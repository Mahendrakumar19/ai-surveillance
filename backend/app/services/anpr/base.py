"""
Base interfaces and data schemas for modular ANPR engines.
Supports:
  1. Indian ANPR (fine-tuned YOLO + multi-pass OCR & Indian plate post-processing)
  2. FastALPR (high-performance ONNX end-to-end detector & OCR)
  3. YOLO + EasyOCR (original surveillance system backup engine)
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import List, Optional, Dict, Any
import numpy as np


@dataclass
class ANPRDetectionResult:
    """Unified result schema returned by any ANPR engine adapter."""
    plate: str = ""                       # Formatted / cleaned plate number (e.g. MH12DE1433)
    raw_plate: str = ""                   # Raw OCR text before positional correction
    confidence: float = 0.0               # Overall confidence score (0.0 to 1.0)
    vehicle_type: str = "car"             # car, motorcycle, truck, bus
    bounding_box: Optional[List[int]] = None  # [x1, y1, x2, y2] relative to input image
    cropped_plate_base64: Optional[str] = None  # data:image/jpeg;base64,...
    is_valid_format: bool = False         # True if matched Indian RTO standards
    engine: str = ""                      # Engine ID that produced this detection
    processing_time_ms: float = 0.0       # End-to-end latency in milliseconds
    metadata: Dict[str, Any] = field(default_factory=dict)


class BaseANPREngine(ABC):
    """Abstract base class for all vehicle license plate recognition engines."""

    @property
    @abstractmethod
    def engine_id(self) -> str:
        """Unique identifier for this engine (e.g. 'indian_anpr', 'fast_alpr', 'yolo_easyocr')."""
        pass

    @property
    @abstractmethod
    def name(self) -> str:
        """Human-readable display name for UI."""
        pass

    @property
    @abstractmethod
    def description(self) -> str:
        """Short description of the engine's methodology and strengths."""
        pass

    @abstractmethod
    def detect_and_read(
        self,
        img_bgr: np.ndarray,
        is_live_stream: bool = False
    ) -> ANPRDetectionResult:
        """
        Detect vehicle and license plate in an image frame (BGR format)
        and extract the recognized registration number.
        """
        pass
