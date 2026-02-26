import logging
import os
import sys
from datetime import datetime
from pathlib import Path

from colorama import Fore, Style

# ─────────────────────────────────────────────
# Custom SUCCESS level (between INFO=20 and WARNING=30)
# ─────────────────────────────────────────────
SUCCESS_LEVEL_NUM = 25
logging.addLevelName(SUCCESS_LEVEL_NUM, "SUCCESS")


def success(self, message, *args, **kwargs):
    if self.isEnabledFor(SUCCESS_LEVEL_NUM):
        self._log(SUCCESS_LEVEL_NUM, message, args, **kwargs)


logging.Logger.success = success


class ColorFormatter(logging.Formatter):
    COLORS = {
        logging.DEBUG:    Fore.BLUE,
        logging.INFO:     Fore.YELLOW,
        logging.WARNING:  Fore.MAGENTA,
        logging.ERROR:    Fore.RED,
        SUCCESS_LEVEL_NUM: Fore.GREEN,
        logging.CRITICAL: Fore.RED + Style.BRIGHT,
    }

    def format(self, record):
        color = self.COLORS.get(record.levelno, "")
        reset = Style.RESET_ALL
        message = super().format(record)
        return f"{color}{message}{reset}"


def setup_logging(
    name: str,
    log_level: int = logging.INFO,
    default_log_dir: str = "data_ingestion_logs",
    console: bool = True,
    overwrite_handlers: bool = True,
) -> logging.Logger:
    """
    Set up a named logger with file + optional console output.

    Args:
        name:              Logger name; also used as subdirectory under log_dir.
        log_level:         Logging threshold. Defaults to INFO.
        default_log_dir:   Root directory for log files.
        console:           Whether to also emit logs to stdout.
        overwrite_handlers: Clear existing handlers to avoid duplicate output.

    Returns:
        Configured logging.Logger instance.
    """
    try:
        log_directory = Path(os.getcwd()).resolve().parent.parent / default_log_dir
    except FileNotFoundError:
        log_directory = Path(default_log_dir)

    log_subdir = log_directory / name
    log_subdir.mkdir(parents=True, exist_ok=True)

    log_file = log_subdir / f"run_{datetime.now().strftime('%Y-%m-%d_%H-%M-%S')}.log"

    logger = logging.getLogger(name)
    logger.setLevel(log_level)

    if overwrite_handlers:
        logger.handlers.clear()

    file_formatter    = logging.Formatter("%(asctime)s - %(levelname)s - %(message)s")
    console_formatter = ColorFormatter("%(asctime)s - %(message)s")

    file_handler = logging.FileHandler(log_file, encoding="utf-8")
    file_handler.setLevel(log_level)
    file_handler.setFormatter(file_formatter)
    logger.addHandler(file_handler)

    if console:
        console_handler = logging.StreamHandler(sys.stdout)
        console_handler.setLevel(log_level)
        console_handler.setFormatter(console_formatter)
        logger.addHandler(console_handler)

    return logger
