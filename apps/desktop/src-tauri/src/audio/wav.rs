use std::io::Cursor;

pub fn samples_to_wav_bytes(samples: &[f32], sample_rate: u32) -> Result<Vec<u8>, hound::Error> {
    let spec = hound::WavSpec {
        channels: 1,
        sample_rate,
        bits_per_sample: 16,
        sample_format: hound::SampleFormat::Int,
    };

    let mut cursor = Cursor::new(Vec::new());
    {
        let mut writer = hound::WavWriter::new(&mut cursor, spec)?;
        for &s in samples {
            let clamped = s.max(-1.0).min(1.0);
            let val = (clamped * 32767.0) as i16;
            writer.write_sample(val)?;
        }
        writer.finalize()?;
    }

    Ok(cursor.into_inner())
}
