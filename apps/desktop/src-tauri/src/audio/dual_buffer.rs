use std::sync::Mutex;

pub struct CircularRingBuffer {
    buffer: Mutex<Vec<f32>>,
    capacity: usize,
    write_pos: Mutex<usize>,
}

impl CircularRingBuffer {
    pub fn new(capacity: usize) -> Self {
        Self {
            buffer: Mutex::new(vec![0.0; capacity]),
            capacity,
            write_pos: Mutex::new(0),
        }
    }

    pub fn write_samples(&self, samples: &[f32]) {
        let mut buffer = self.buffer.lock().unwrap();
        let mut pos = self.write_pos.lock().unwrap();

        for &sample in samples {
            buffer[*pos] = sample;
            *pos = (*pos + 1) % self.capacity;
        }
    }

    pub fn get_recent_samples(&self, num_samples: usize) -> Vec<f32> {
        let buffer = self.buffer.lock().unwrap();
        let pos = *self.write_pos.lock().unwrap();
        let count = num_samples.min(self.capacity);

        let mut result = Vec::with_capacity(count);
        let start = (pos + self.capacity - count) % self.capacity;

        for i in 0..count {
            let idx = (start + i) % self.capacity;
            result.push(buffer[idx]);
        }

        result
    }

    pub fn clear(&self) {
        let mut buffer = self.buffer.lock().unwrap();
        let mut pos = self.write_pos.lock().unwrap();
        buffer.fill(0.0);
        *pos = 0;
    }
}
