"""SimEnv for the compact YuLan-OneSim platform scenario.

This file was manually copied from the platform code view supplied by the
project owner on 2026-09-15. The platform description compares S0-S3
mechanisms for gig workers reporting urban governance issues. All data are
synthetic and are used only for exploratory mechanism comparison.
"""

from onesim.simulator import BasicSimEnv
from onesim.events import Event
from .events import StartEvent


class SimEnv(BasicSimEnv):
    """Environment for the simulation. Manages shared state and start events."""

    async def _create_start_event(self, target_id: str) -> Event:
        """Create a StartEvent for ScenarioController."""
        return StartEvent(
            from_agent_id="ENV",
            to_agent_id=target_id,
        )
