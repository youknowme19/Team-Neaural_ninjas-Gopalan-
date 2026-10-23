use std::sync::Mutex;

struct RingBufferInner {
    data: Vec<f32>,
    write_pos: usize,
    total_written: usize,
}

pub struct CircularRingBuffer {
    inner: Mutex<RingBufferInner>,
    capacity: usize,
}

impl CircularRingBuffer {
    pub fn new(capacity: usize) -> Self {
        Self {
            inner: Mutex::new(RingBufferInner {
                data: vec![0.0; capacity],
                write_pos: 0,
                total_written: 0,
            }),
            capacity,
        }
    }

    pub fn write_samples(&self, samples: &[f32]) {
        if samples.is_empty() {
            return;
        }

        let mut inner = self.inner.lock().unwrap();
        let capacity = self.capacity;

        let samples = if samples.len() > capacity {
            &samples[samples.len() - capacity..]
        } else {
            samples
        };

        let num_samples = samples.len();
        let write_pos = inner.write_pos;
        let space_to_end = capacity - write_pos;

        if num_samples <= space_to_end {
            inner.data[write_pos..write_pos + num_samples].copy_from_slice(samples);
            inner.write_pos = (write_pos + num_samples) % capacity;
        } else {
            inner.data[write_pos..capacity].copy_from_slice(&samples[..space_to_end]);
            let remaining = num_samples - space_to_end;
            inner.data[..remaining].copy_from_slice(&samples[space_to_end..]);
            inner.write_pos = remaining;
        }

        inner.total_written += num_samples;
    }

    pub fn get_recent_samples(&self, num_samples: usize) -> Vec<f32> {
        let inner = self.inner.lock().unwrap();
        let count = num_samples.min(self.capacity).min(inner.total_written);

        if count == 0 {
            return Vec::new();
        }

        let mut result = Vec::with_capacity(count);
        let write_pos = inner.write_pos;
        let capacity = self.capacity;

        let start_pos = (write_pos + capacity - count) % capacity;

        if start_pos + count <= capacity {
            result.extend_from_slice(&inner.data[start_pos..start_pos + count]);
        } else {
            let first_part = capacity - start_pos;
            result.extend_from_slice(&inner.data[start_pos..capacity]);
            let second_part = count - first_part;
            result.extend_from_slice(&inner.data[..second_part]);
        }

        result
    }

    pub fn clear(&self) {
        let mut inner = self.inner.lock().unwrap();
        inner.data.fill(0.0);
        inner.write_pos = 0;
        inner.total_written = 0;
    }
}
