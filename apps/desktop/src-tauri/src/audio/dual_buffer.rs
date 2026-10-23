use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;

pub struct CircularBuffer {
    buffer: Vec<f32>,
    capacity: usize,
    write_idx: Arc<AtomicUsize>,
}

impl CircularBuffer {
    pub fn new(capacity: usize) -> Self {
        Self {
            buffer: vec![0.0; capacity],
            capacity,
            write_idx: Arc::new(AtomicUsize::new(0)),
        }
    }

    pub fn push(&mut self, sample: f32) {
        let idx = self.write_idx.fetch_add(1, Ordering::Relaxed) % self.capacity;
        self.buffer[idx] = sample;
    }
}

pub struct DualBuffer {
    pub buffer_local: CircularBuffer,
    pub buffer_remote: CircularBuffer,
}

impl DualBuffer {
    pub fn new(capacity: usize) -> Self {
        Self {
            buffer_local: CircularBuffer::new(capacity),
            buffer_remote: CircularBuffer::new(capacity),
        }
    }
}
