use std::io::Cursor;
use hound::{WavSpec, WavWriter};

pub fn encode_wav_in_memory(samples: &[f32], sample_rate: u32) -> Result<Vec<u8>, hound::Error> {
    let spec = WavSpec {
        channels: 1,
        sample_rate,
        bits_per_sample: 16,
        sample_format: hound::SampleFormat::Int,
    };

    let mut cursor = Cursor::new(Vec::with_capacity(samples.len() * 2 + 44));
    {
        let mut writer = WavWriter::new(&mut cursor, spec)?;
        for &sample in samples {
            // Clamp sample to [-1.0, 1.0] and scale to i16
            let clamped = sample.max(-1.0).min(1.0);
            let scaled = (clamped * 32767.0) as i16;
            writer.write_sample(scaled)?;
        }
        writer.finalize()?;
    }

    Ok(cursor.into_inner())
}
