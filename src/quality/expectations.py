"""Data quality expectations for raw MBTA data.

Lightweight validation framework that works with both
local parquet files (Polars) and BigQuery tables.
"""

from dataclasses import dataclass, field
from typing import Any


@dataclass
class ExpectationResult:
    """Result of a single expectation check."""

    name: str
    passed: bool
    expected: Any = None
    actual: Any = None
    details: str = ""

    def __str__(self) -> str:
        status = "✓" if self.passed else "✗"
        msg = f"  {status} {self.name}"
        if not self.passed:
            msg += f" (expected={self.expected}, actual={self.actual})"
            if self.details:
                msg += f" — {self.details}"
        return msg


@dataclass
class SuiteResult:
    """Result of running a full expectation suite."""

    entity: str
    results: list[ExpectationResult] = field(default_factory=list)

    @property
    def passed(self) -> bool:
        return all(r.passed for r in self.results)

    @property
    def pass_count(self) -> int:
        return sum(1 for r in self.results if r.passed)

    @property
    def fail_count(self) -> int:
        return sum(1 for r in self.results if not r.passed)

    def summary(self) -> str:
        status = "PASSED" if self.passed else "FAILED"
        lines = [
            f"\n{'='*50}",
            f"  {self.entity}: {status} "
            f"({self.pass_count}/{len(self.results)} checks passed)",
            f"{'='*50}",
        ]
        for r in self.results:
            lines.append(str(r))
        return "\n".join(lines)
