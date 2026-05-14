
import gradio as gr
import torch
from transformers import VitsModel, AutoTokenizer
import io
import numpy as np
import scipy.io.wavfile
import tempfile
import os

# Load the Tibetan TTS model
print("Loading Tibetan TTS model...")
model = VitsModel.from_pretrained("facebook/mms-tts-bod")
tokenizer = AutoTokenizer.from_pretrained("facebook/mms-tts-bod")
print("Model loaded successfully!")

def generate_tibetan_speech(text):
    """Generate Tibetan speech from text"""
    try:
        if not text.strip():
            return None, "Please enter some Tibetan text"

        # Tokenize the input text
        inputs = tokenizer(text, return_tensors="pt")

        # Generate speech
        with torch.no_grad():
            output = model(**inputs).waveform

        # Convert to numpy array and prepare for audio output
        audio_data = output.squeeze().cpu().numpy()

        # Normalize audio data
        audio_data = audio_data / np.max(np.abs(audio_data))

        # Convert to 16-bit integers
        audio_data = (audio_data * 32767).astype(np.int16)

        # Create temporary file
        with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp_file:
            scipy.io.wavfile.write(tmp_file.name, model.config.sampling_rate, audio_data)
            return tmp_file.name, "Audio generated successfully!"

    except Exception as e:
        return None, f"Error generating speech: {str(e)}"

def api_generate_speech(text):
    """API endpoint for speech generation"""
    audio_file, message = generate_tibetan_speech(text)
    if audio_file:
        return audio_file
    else:
        raise gr.Error(message)

# Create Gradio interface
with gr.Blocks(title="Tibetan Text-to-Speech", theme=gr.themes.Soft()) as app:
    gr.Markdown("# 🎵 Tibetan Text-to-Speech Service")
    gr.Markdown("Convert Tibetan text to natural-sounding speech using Meta's MMS model")

    with gr.Row():
        with gr.Column(scale=2):
            text_input = gr.Textbox(
                label="Tibetan Text",
                placeholder="Enter Tibetan text here... (བོད་ཡིག་འདིར་འབྲི་རོགས།)",
                lines=3,
                max_lines=5
            )
            generate_btn = gr.Button("🔊 Generate Speech", variant="primary", size="lg")

        with gr.Column(scale=2):
            audio_output = gr.Audio(
                label="Generated Speech",
                type="filepath",
                interactive=False
            )
            status_text = gr.Textbox(
                label="Status",
                interactive=False,
                max_lines=2
            )

    # Examples
    gr.Examples(
        examples=[
            ["བཀྲ་ཤིས་བདེ་ལེགས།"],
            ["སྐུ་གཟུགས་བཟང་པོ་ཡིན་པས།"],
            ["ང་རང་བོད་པ་ཞིག་ཡིན།"],
            ["ཁྱེད་རང་ག་རེ་བྱེད་ཀྱི་ཡོད།"]
        ],
        inputs=text_input
    )

    # Event handlers
    generate_btn.click(
        fn=generate_tibetan_speech,
        inputs=text_input,
        outputs=[audio_output, status_text]
    )

    text_input.submit(
        fn=generate_tibetan_speech,
        inputs=text_input,
        outputs=[audio_output, status_text]
    )

# API endpoint for external calls
app.queue()

if __name__ == "__main__":
    app.launch(server_name="0.0.0.0", server_port=7860)