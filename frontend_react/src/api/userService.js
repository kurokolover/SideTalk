//User ID
const STORAGE_KEY = 'sidetalk_user_id';

const generateUserId = () => {
  const num = Math.floor(100000 + Math.random() * 900000);
  return `id${num}`;
};

class UserService {
  constructor() {
    this._userId = null;
    this._initialized = false;
  }

  initialize() {
    if (this._initialized) {
      return this._userId;
    }

    try {
      const storedId = localStorage.getItem(STORAGE_KEY);

      if (storedId) {
        this._userId = storedId;
        console.log('UserService: Loaded existing user ID:', this._userId);
      } else {
        this._userId = generateUserId();
        localStorage.setItem(STORAGE_KEY, this._userId);
        console.log('UserService: Generated new user ID:', this._userId);
      }

      this._initialized = true;
    } catch (error) {
      console.warn('UserService: localStorage not available, using temporary ID');
      this._userId = generateUserId();
      this._initialized = true;
    }

    return this._userId;
  }

  getUserId() {
    if (!this._initialized) {
      this.initialize();
    }
    return this._userId;
  }

  resetUserId() {
    this._userId = generateUserId();
    try {
      localStorage.setItem(STORAGE_KEY, this._userId);
    } catch (error) {
      console.warn('UserService: Could not persist new user ID');
    }
    console.log('UserService: Reset user ID to:', this._userId);
    return this._userId;
  }

  isInitialized() {
    return this._initialized;
  }
}

const userService = new UserService();

userService.initialize();

export default userService;

export const getUserId = () => userService.getUserId();
