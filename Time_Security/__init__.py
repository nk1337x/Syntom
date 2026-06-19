"""
Time Security Module
"""

from .time_dilation import compute_chunk_delay, derive_time_salt, compute_time_drift

__all__ = ['compute_chunk_delay', 'derive_time_salt', 'compute_time_drift']
