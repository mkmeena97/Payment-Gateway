export const validateEmail = (email) => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
};

export const validatePassword = (password) => {
  // At least 8 characters, 1 uppercase, 1 lowercase, 1 number
  const re = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d]{8,}$/;
  return re.test(password);
};

export const validateRegistration = (data) => {
  const errors = {};

  if (!data.email || !validateEmail(data.email)) {
    errors.email = 'Valid email is required';
  }

  if (!data.password || !validatePassword(data.password)) {
    errors.password = 'Password must be at least 8 characters with 1 uppercase, 1 lowercase, and 1 number';
  }

  if (!data.firstName?.trim()) {
    errors.firstName = 'First name is required';
  }

  if (!data.lastName?.trim()) {
    errors.lastName = 'Last name is required';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};
