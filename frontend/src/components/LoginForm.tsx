import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/AuthContext';
import { PasswordInput } from './PasswordInput';
import { User, LogIn, AlertCircle, Info, ShieldCheck } from 'lucide-react';

const loginFormSchema = z.object({
  username: z.string().min(1, 'Username or Login ID is required'),
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().default(false)
});

type LoginFormData = z.infer<typeof loginFormSchema>;

export const LoginForm: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [authError, setAuthError] = useState<string | null>(null);
  const [showForgotNotice, setShowForgotNotice] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: {
      username: '',
      password: '',
      rememberMe: false
    }
  });

  const onSubmit = async (data: LoginFormData) => {
    setAuthError(null);
    const result = await login(data.username, data.password);

    if (result.success) {
      // Step 11: Redirect user immediately to /dashboard
      navigate('/dashboard', { replace: true });
    } else {
      setAuthError(result.error || 'Invalid username or password.');
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      {/* Form Card Header */}
      <div className="mb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-teal-light text-teal-accent text-xs font-semibold rounded-full mb-3">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Oracle 19c Enterprise Authentication</span>
        </div>
        <h2 className="text-2xl font-bold text-text-main tracking-tight">
          Welcome Back
        </h2>
        <p className="mt-1.5 text-sm text-text-secondary">
          Sign in to access your insurance operations workspace.
        </p>
      </div>

      {/* Forgot Password Modal/Notice */}
      {showForgotNotice && (
        <div className="mb-6 p-4 rounded-lg bg-blue-50 border border-blue-200 text-blue-900 text-xs flex items-start justify-between shadow-sm">
          <div className="flex items-start gap-2.5">
            <Info className="w-4 h-4 text-blue-corp text-blue-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-semibold text-blue-800">Password Reset Assistance</p>
              <p className="mt-0.5 text-blue-700">
                Self-service password recovery is planned for a future phase. Please contact your Life Insurance Systems Administrator to reset your credentials.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowForgotNotice(false)}
            className="text-blue-500 hover:text-blue-700 font-bold ml-2 text-sm"
          >
            &times;
          </button>
        </div>
      )}

      {/* Generic Authentication Error Alert */}
      {authError && (
        <div
          role="alert"
          className="mb-6 p-4 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm flex items-start gap-3 shadow-sm transition-all"
        >
          <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="font-semibold text-red-900">Authentication Failed</p>
            <p className="mt-0.5 text-red-700 text-xs leading-relaxed">{authError}</p>
          </div>
        </div>
      )}

      {/* Form Element */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
        {/* Username field */}
        <div>
          <label
            htmlFor="username"
            className="block text-xs font-semibold text-text-main uppercase tracking-wider mb-1.5"
          >
            Username / Login ID
          </label>
          <div className="relative rounded-lg shadow-sm">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <User className="w-4 h-4" />
            </div>
            <input
              id="username"
              type="text"
              autoComplete="username"
              placeholder="e.g. admin"
              {...register('username')}
              className={`w-full pl-10 pr-4 py-2.5 bg-white text-sm text-text-main placeholder-slate-400 rounded-lg border ${
                errors.username
                  ? 'border-red-400 focus:ring-red-200 focus:border-red-500'
                  : 'border-slate-300 focus:ring-blue-100 focus:border-navy'
              } transition duration-150 focus:outline-none focus:ring-4`}
            />
          </div>
          {errors.username && (
            <p className="mt-1.5 text-xs text-red-600 font-medium">
              {errors.username.message}
            </p>
          )}
        </div>

        {/* Password field */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label
              htmlFor="password"
              className="block text-xs font-semibold text-text-main uppercase tracking-wider"
            >
              Password
            </label>
            <button
              type="button"
              onClick={() => setShowForgotNotice(true)}
              className="text-xs font-medium text-blue-corporate hover:underline focus:outline-none transition-colors"
            >
              Forgot Password?
            </button>
          </div>
          <PasswordInput
            id="password"
            autoComplete="current-password"
            placeholder="•••••••••"
            error={errors.password?.message}
            {...register('password')}
          />
        </div>

        {/* Remember Me Checkbox */}
        <div className="flex items-center justify-between pt-1">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              id="rememberMe"
              {...register('rememberMe')}
              className="w-4 h-4 rounded text-navy border-slate-300 focus:ring-navy focus:ring-2 cursor-pointer"
            />
            <span className="text-xs text-text-secondary select-none">
              Remember my user ID on this browser
            </span>
          </label>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          id="signInButton"
          disabled={isSubmitting}
          className="w-full mt-2 py-3 px-4 bg-navy hover:bg-navy-light text-white text-sm font-semibold rounded-lg shadow-sm hover:shadow transition-all duration-200 flex items-center justify-center gap-2 focus:outline-none focus:ring-4 focus:ring-navy/20 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isSubmitting ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>Authenticating against Oracle...</span>
            </>
          ) : (
            <>
              <LogIn className="w-4 h-4" />
              <span>Sign In</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
};
