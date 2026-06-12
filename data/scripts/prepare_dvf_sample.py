from __future__ import annotations

from build_bronze import main as build_bronze_main
from build_gold import main as build_gold_main
from build_silver import main as build_silver_main


def log(message: str) -> None:
    print(f"[prepare_dvf_sample] {message}")


def main() -> None:
    log("prepare_dvf_sample.py is now a compatibility wrapper")
    log("Running bronze -> silver -> gold DVF pipeline")
    build_bronze_main()
    build_silver_main()
    build_gold_main()


if __name__ == "__main__":
    main()
