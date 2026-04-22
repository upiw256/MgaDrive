import Swal from 'sweetalert2';

const Toast = Swal.mixin({
  toast: true,
  position: 'top-end',
  showConfirmButton: false,
  timer: 3000,
  timerProgressBar: true,
  background: '#1e293b', // slate-800
  color: '#f8fafc', // slate-50
  didOpen: (toast) => {
    toast.addEventListener('mouseenter', Swal.stopTimer);
    toast.addEventListener('mouseleave', Swal.resumeTimer);
  }
});

const PremiumSwal = Swal.mixin({
  background: '#0f172a', // slate-900
  color: '#f8fafc', // slate-50
  confirmButtonColor: '#2563eb', // blue-600
  cancelButtonColor: '#ef4444', // red-500
  customClass: {
    popup: 'rounded-2xl border border-slate-800 shadow-2xl backdrop-blur-xl',
    title: 'text-2xl font-bold',
    confirmButton: 'px-6 py-2.5 rounded-xl font-bold transition-all hover:scale-105 active:scale-95',
    cancelButton: 'px-6 py-2.5 rounded-xl font-bold transition-all hover:scale-105 active:scale-95',
  },
  backdrop: `
    rgba(0,0,0,0.4)
    backdrop-filter: blur(4px);
  `
});

export const showToast = (icon, title) => {
  Toast.fire({
    icon,
    title
  });
};

export const showAlert = (icon, title, text) => {
  return PremiumSwal.fire({
    icon,
    title,
    text,
  });
};

export const showConfirm = (title, text, confirmButtonText = 'Yes, do it!') => {
  return PremiumSwal.fire({
    title,
    text,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText,
    cancelButtonText: 'Cancel',
  });
};

export const showProgressAlert = (title, text) => {
  return PremiumSwal.fire({
    title,
    html: `
      <div class="space-y-4 py-4">
        <p class="text-sm text-slate-400">${text}</p>
        <div class="w-full bg-slate-800 rounded-full h-3 overflow-hidden">
          <div id="progress-bar" class="bg-blue-600 h-full transition-all duration-300" style="width: 0%"></div>
        </div>
        <p id="progress-text" class="text-xs font-bold text-blue-400">0%</p>
      </div>
    `,
    showConfirmButton: false,
    allowOutsideClick: false,
    allowEscapeKey: false,
  });
};

export default PremiumSwal;
