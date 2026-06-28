from __future__ import annotations

import subprocess
import unittest
from unittest import mock

from scripts.orchestration import build_dvf


class BuildDvfOrchestrationTests(unittest.TestCase):
    def test_try_run_step_returns_false_for_unreachable_legacy_resource(self) -> None:
        completed = subprocess.CompletedProcess(
            args=["python", "-m", "data.scripts.dvf.download", "--year", "2017"],
            returncode=1,
            stdout="",
            stderr=(
                "RuntimeError: Legacy DVF resource for year 2017 is not reachable at "
                "https://www.data.gouv.fr/fr/datasets/r/7161c9f2-3d91-4caf-afa2-cfe535807f04."
            ),
        )

        with mock.patch("scripts.orchestration.build_dvf.subprocess.run", return_value=completed):
            self.assertFalse(build_dvf.try_run_step("-m", "data.scripts.dvf.download", "--year", "2017"))


if __name__ == "__main__":
    unittest.main()
