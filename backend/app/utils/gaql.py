"""
GAQL (Google Ads Query Language) Builder

Helper utility for building GAQL queries programmatically.
"""

from typing import List, Optional, Dict, Any
from datetime import date


class GAQLBuilder:
    """
    Builder for Google Ads Query Language (GAQL) queries.
    
    Example:
        query = (
            GAQLBuilder()
            .select(["campaign.id", "campaign.name", "metrics.impressions"])
            .from_resource("campaign")
            .where("campaign.status", "=", "ENABLED")
            .where_date_range(start_date, end_date)
            .order_by("metrics.impressions", desc=True)
            .limit(100)
            .build()
        )
    """
    
    def __init__(self):
        self._select: List[str] = []
        self._from: str = ""
        self._where: List[str] = []
        self._order_by: List[str] = []
        self._limit: Optional[int] = None
        self._parameters: Dict[str, str] = {}
    
    def select(self, fields: List[str]) -> "GAQLBuilder":
        """
        Add fields to SELECT clause.
        
        Args:
            fields: List of field names to select
        """
        self._select.extend(fields)
        return self
    
    def from_resource(self, resource: str) -> "GAQLBuilder":
        """
        Set the FROM resource.
        
        Args:
            resource: Resource name (e.g., "campaign", "ad_group", "keyword_view")
        """
        self._from = resource
        return self
    
    def where(
        self,
        field: str,
        operator: str,
        value: Any
    ) -> "GAQLBuilder":
        """
        Add a WHERE condition.
        
        Args:
            field: Field name
            operator: Comparison operator (=, !=, <, >, <=, >=, IN, NOT IN, LIKE, etc.)
            value: Value to compare against
        """
        if isinstance(value, str):
            if operator.upper() in ("IN", "NOT IN"):
                condition = f"{field} {operator} ({value})"
            else:
                condition = f"{field} {operator} '{value}'"
        elif isinstance(value, (list, tuple)):
            values_str = ", ".join(f"'{v}'" if isinstance(v, str) else str(v) for v in value)
            condition = f"{field} {operator} ({values_str})"
        else:
            condition = f"{field} {operator} {value}"
        
        self._where.append(condition)
        return self
    
    def where_date_range(
        self,
        start_date: date,
        end_date: date,
        field: str = "segments.date"
    ) -> "GAQLBuilder":
        """
        Add date range filter.
        
        Args:
            start_date: Start date
            end_date: End date
            field: Date field to filter on (default: segments.date)
        """
        self._where.append(f"{field} >= '{start_date.strftime('%Y-%m-%d')}'")
        self._where.append(f"{field} <= '{end_date.strftime('%Y-%m-%d')}'")
        return self
    
    def where_raw(self, condition: str) -> "GAQLBuilder":
        """
        Add a raw WHERE condition string.
        
        Args:
            condition: Raw condition string
        """
        self._where.append(condition)
        return self
    
    def order_by(self, field: str, desc: bool = False) -> "GAQLBuilder":
        """
        Add ORDER BY clause.
        
        Args:
            field: Field to order by
            desc: If True, order descending
        """
        direction = "DESC" if desc else "ASC"
        self._order_by.append(f"{field} {direction}")
        return self
    
    def limit(self, count: int) -> "GAQLBuilder":
        """
        Set LIMIT clause.
        
        Args:
            count: Maximum number of rows to return
        """
        self._limit = count
        return self
    
    def parameter(self, name: str, value: str) -> "GAQLBuilder":
        """
        Add a query parameter.
        
        Args:
            name: Parameter name
            value: Parameter value
        """
        self._parameters[name] = value
        return self
    
    def build(self) -> str:
        """
        Build the GAQL query string.
        
        Returns:
            Complete GAQL query string
        """
        if not self._select:
            raise ValueError("SELECT clause is required")
        if not self._from:
            raise ValueError("FROM clause is required")
        
        parts = []
        
        # SELECT
        parts.append(f"SELECT {', '.join(self._select)}")
        
        # FROM
        parts.append(f"FROM {self._from}")
        
        # WHERE
        if self._where:
            parts.append(f"WHERE {' AND '.join(self._where)}")
        
        # ORDER BY
        if self._order_by:
            parts.append(f"ORDER BY {', '.join(self._order_by)}")
        
        # LIMIT
        if self._limit:
            parts.append(f"LIMIT {self._limit}")
        
        # PARAMETERS
        if self._parameters:
            params = ", ".join(f"{k}={v}" for k, v in self._parameters.items())
            parts.append(f"PARAMETERS {params}")
        
        return " ".join(parts)
    
    def __str__(self) -> str:
        return self.build()


# Preset queries for common operations
class GAQLPresets:
    """Common GAQL query presets."""
    
    @staticmethod
    def campaigns_list() -> str:
        """Query to list all campaigns."""
        return (
            GAQLBuilder()
            .select([
                "campaign.id",
                "campaign.name",
                "campaign.status",
                "campaign.advertising_channel_type"
            ])
            .from_resource("campaign")
            .where("campaign.status", "!=", "REMOVED")
            .order_by("campaign.name")
            .build()
        )
    
    @staticmethod
    def campaign_metrics(start_date: date, end_date: date) -> str:
        """Query for campaign performance metrics."""
        return (
            GAQLBuilder()
            .select([
                "campaign.id",
                "campaign.name",
                "segments.date",
                "segments.device",
                "segments.ad_network_type",
                "metrics.impressions",
                "metrics.clicks",
                "metrics.cost_micros",
                "metrics.conversions",
                "metrics.conversions_value"
            ])
            .from_resource("campaign")
            .where_date_range(start_date, end_date)
            .order_by("segments.date")
            .order_by("campaign.id")
            .build()
        )
    
    @staticmethod
    def hourly_metrics(target_date: date) -> str:
        """Query for hourly metrics (for spike detection)."""
        return (
            GAQLBuilder()
            .select([
                "campaign.id",
                "segments.date",
                "segments.hour",
                "metrics.impressions",
                "metrics.clicks",
                "metrics.cost_micros",
                "metrics.conversions"
            ])
            .from_resource("campaign")
            .where("segments.date", "=", target_date.strftime("%Y-%m-%d"))
            .order_by("segments.hour")
            .order_by("campaign.id")
            .build()
        )
