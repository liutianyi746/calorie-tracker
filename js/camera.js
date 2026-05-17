// js/camera.js

export function initCamera() {
  const input = document.getElementById('camera-input');
  const btn = document.getElementById('btn-capture');
  const preview = document.getElementById('photo-preview');

  btn.addEventListener('click', () => input.click());

  input.addEventListener('change', () => {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      preview.src = e.target.result;
      preview.style.display = 'block';
      btn.style.display = 'none';
      preview.addEventListener('click', () => {
        preview.style.display = 'none';
        btn.style.display = 'flex';
        input.value = '';
      }, { once: true });
    };
    reader.readAsDataURL(file);
  });
}
