export function initCamera() {
  const cameraInput = document.getElementById('camera-input');
  const galleryInput = document.getElementById('gallery-input');
  const btnCamera = document.getElementById('btn-capture');
  const btnGallery = document.getElementById('btn-gallery');
  const preview = document.getElementById('photo-preview');
  const container = document.querySelector('.capture-buttons');

  function showFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      preview.src = e.target.result;
      preview.style.display = 'block';
      container.style.display = 'none';
    };
    reader.readAsDataURL(file);
  }

  btnCamera.addEventListener('click', () => cameraInput.click());
  btnGallery.addEventListener('click', () => galleryInput.click());

  cameraInput.addEventListener('change', () => showFile(cameraInput.files[0]));
  galleryInput.addEventListener('change', () => showFile(galleryInput.files[0]));

  preview.addEventListener('click', () => {
    preview.style.display = 'none';
    container.style.display = 'flex';
    cameraInput.value = '';
    galleryInput.value = '';
  });
}
