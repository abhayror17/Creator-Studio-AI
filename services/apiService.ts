// API service utilities for Creator Studio AI
// This file contains helper functions for making API requests

export interface ApiResponse<T = any> {
  data?: T;
  error?: string;
  status: number;
}

/**
 * Generic fetch wrapper with error handling
 */
export const apiRequest = async <T = any>(
  url: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> => {
  try {
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });

    const status = response.status;
    
    if (!response.ok) {
      const errorText = await response.text();
      return {
        error: errorText || `HTTP error! status: ${status}`,
        status,
      };
    }

    let data;
    const contentType = response.headers.get('content-type');
    
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    return {
      data,
      status,
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      status: 0,
    };
  }
};

/**
 * GET request helper
 */
export const get = async <T = any>(
  url: string,
  options: Omit<RequestInit, 'method'> = {}
): Promise<ApiResponse<T>> => {
  return apiRequest<T>(url, { ...options, method: 'GET' });
};

/**
 * POST request helper
 */
export const post = async <T = any>(
  url: string,
  data?: any,
  options: Omit<RequestInit, 'method' | 'body'> = {}
): Promise<ApiResponse<T>> => {
  return apiRequest<T>(url, {
    ...options,
    method: 'POST',
    body: data ? JSON.stringify(data) : undefined,
  });
};

/**
 * PUT request helper
 */
export const put = async <T = any>(
  url: string,
  data?: any,
  options: Omit<RequestInit, 'method' | 'body'> = {}
): Promise<ApiResponse<T>> => {
  return apiRequest<T>(url, {
    ...options,
    method: 'PUT',
    body: data ? JSON.stringify(data) : undefined,
  });
};

/**
 * DELETE request helper
 */
export const del = async <T = any>(
  url: string,
  options: Omit<RequestInit, 'method'> = {}
): Promise<ApiResponse<T>> => {
  return apiRequest<T>(url, { ...options, method: 'DELETE' });
};

/**
 * Upload file helper
 */
export const uploadFile = async <T = any>(
  url: string,
  file: File,
  options: Omit<RequestInit, 'method' | 'body' | 'headers'> = {}
): Promise<ApiResponse<T>> => {
  const formData = new FormData();
  formData.append('file', file);

  try {
    const response = await fetch(url, {
      method: 'POST',
      body: formData,
      ...options,
    });

    const status = response.status;
    
    if (!response.ok) {
      const errorText = await response.text();
      return {
        error: errorText || `HTTP error! status: ${status}`,
        status,
      };
    }

    let data;
    const contentType = response.headers.get('content-type');
    
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    return {
      data,
      status,
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      status: 0,
    };
  }
};

/**
 * Retry wrapper for API requests
 */
export const withRetry = async <T = any>(
  apiCall: () => Promise<ApiResponse<T>>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<ApiResponse<T>> => {
  let lastError: ApiResponse<T>;

  for (let i = 0; i <= maxRetries; i++) {
    try {
      const result = await apiCall();
      if (result.error && i < maxRetries) {
        lastError = result;
        await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)));
        continue;
      }
      return result;
    } catch (error) {
      if (i < maxRetries) {
        lastError = {
          error: error instanceof Error ? error.message : 'Unknown error occurred',
          status: 0,
        };
        await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)));
        continue;
      }
      throw error;
    }
  }

  return lastError!;
};