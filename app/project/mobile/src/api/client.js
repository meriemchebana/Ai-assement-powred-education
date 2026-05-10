import * as SecureStore from 'expo-secure-store';
import { API_BASE_URL } from './config';

async function getToken() {
  return await SecureStore.getItemAsync('token');
}

export async function setTokenStorage(token) {
  await SecureStore.setItemAsync('token', token);
}

export async function removeTokenStorage() {
  await SecureStore.deleteItemAsync('token');
}

async function apiCall(endpoint, options = {}) {
  const token = await getToken();
  
  const config = {
    headers: {
      ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    ...options,
  };

  const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Something went wrong');
  }
  
  return response.json();
}

// Auth APIs
export const authAPI = {
  login: (email, password) =>
    apiCall('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
    
  register: (data) =>
    apiCall('/teachers/register', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

// Subjects APIs
export const subjectsAPI = {
  getAll: () => apiCall('/subjects/'),
  getOne: (id) => apiCall(`/subjects/${id}`),
  create: (data) => apiCall('/subjects/', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => apiCall(`/subjects/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id) => apiCall(`/subjects/${id}`, { method: 'DELETE' }),
};

// Courses APIs
export const coursesAPI = {
  getAll: (subjectId) => apiCall(`/subjects/${subjectId}/courses/`),
  getOne: (subjectId, courseId) => apiCall(`/subjects/${subjectId}/courses/${courseId}`),
  create: (subjectId, data) => apiCall(`/subjects/${subjectId}/courses/`, { method: 'POST', body: JSON.stringify(data) }),
  update: (subjectId, courseId, data) => apiCall(`/subjects/${subjectId}/courses/${courseId}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (subjectId, courseId) => apiCall(`/subjects/${subjectId}/courses/${courseId}`, { method: 'DELETE' }),
  uploadPDF: (subjectId, courseId, file) => {
    const formData = new FormData();
    formData.append('file', {
      uri: file.uri,
      type: file.mimeType || 'application/pdf',
      name: file.name || 'document.pdf',
    });
    return apiCall(`/subjects/${subjectId}/courses/${courseId}/pdfs`, {
      method: 'POST',
      body: formData,
    });
  },
  deletePDF: (subjectId, courseId, pdfId) => apiCall(`/subjects/${subjectId}/courses/${courseId}/pdfs/${pdfId}`, { method: 'DELETE' }),
  getPDFUrl: (subjectId, courseId, pdfId) =>
    `${API_BASE_URL}/subjects/${subjectId}/courses/${courseId}/pdfs/${pdfId}`,
};

// Practical Series APIs
export const practicalSeriesAPI = {
  getAll: (subjectId) => apiCall(`/subjects/${subjectId}/practical-series/`),
  getOne: (subjectId, seriesId) => apiCall(`/subjects/${subjectId}/practical-series/${seriesId}`),
  create: (subjectId, data) => apiCall(`/subjects/${subjectId}/practical-series/`, { method: 'POST', body: JSON.stringify(data) }),
  update: (subjectId, seriesId, data) => apiCall(`/subjects/${subjectId}/practical-series/${seriesId}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (subjectId, seriesId) => apiCall(`/subjects/${subjectId}/practical-series/${seriesId}`, { method: 'DELETE' }),
  uploadPDF: (subjectId, seriesId, file) => {
    const formData = new FormData();
    formData.append('file', {
      uri: file.uri,
      type: file.mimeType || 'application/pdf',
      name: file.name || 'document.pdf',
    });
    return apiCall(`/subjects/${subjectId}/practical-series/${seriesId}/pdfs`, { method: 'POST', body: formData });
  },
  deletePDF: (subjectId, seriesId, pdfId) => apiCall(`/subjects/${subjectId}/practical-series/${seriesId}/pdfs/${pdfId}`, { method: 'DELETE' }),
  getPDFUrl: (subjectId, seriesId, pdfId) => `${API_BASE_URL}/subjects/${subjectId}/practical-series/${seriesId}/pdfs/${pdfId}`,
};

// Theoretical Series APIs
export const theoreticalSeriesAPI = {
  getAll: (subjectId) => apiCall(`/subjects/${subjectId}/theoretical-series/`),
  getOne: (subjectId, seriesId) => apiCall(`/subjects/${subjectId}/theoretical-series/${seriesId}`),
  create: (subjectId, data) => apiCall(`/subjects/${subjectId}/theoretical-series/`, { method: 'POST', body: JSON.stringify(data) }),
  update: (subjectId, seriesId, data) => apiCall(`/subjects/${subjectId}/theoretical-series/${seriesId}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (subjectId, seriesId) => apiCall(`/subjects/${subjectId}/theoretical-series/${seriesId}`, { method: 'DELETE' }),
  uploadPDF: (subjectId, seriesId, file) => {
    const formData = new FormData();
    formData.append('file', {
      uri: file.uri,
      type: file.mimeType || 'application/pdf',
      name: file.name || 'document.pdf',
    });
    return apiCall(`/subjects/${subjectId}/theoretical-series/${seriesId}/pdfs`, { method: 'POST', body: formData });
  },
  deletePDF: (subjectId, seriesId, pdfId) => apiCall(`/subjects/${subjectId}/theoretical-series/${seriesId}/pdfs/${pdfId}`, { method: 'DELETE' }),
  getPDFUrl: (subjectId, seriesId, pdfId) => `${API_BASE_URL}/subjects/${subjectId}/theoretical-series/${seriesId}/pdfs/${pdfId}`,
};

// Exams APIs
export const examsAPI = {
  getAll: (subjectId) => apiCall(`/subjects/${subjectId}/exams/`),
  getOne: (subjectId, examId) => apiCall(`/subjects/${subjectId}/exams/${examId}`),
  create: (subjectId, data) => apiCall(`/subjects/${subjectId}/exams/`, { method: 'POST', body: JSON.stringify(data) }),
  update: (subjectId, examId, data) => apiCall(`/subjects/${subjectId}/exams/${examId}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (subjectId, examId) => apiCall(`/subjects/${subjectId}/exams/${examId}`, { method: 'DELETE' }),
  uploadPDF: (subjectId, examId, file) => {
    const formData = new FormData();
    formData.append('file', {
      uri: file.uri,
      type: file.mimeType || 'application/pdf',
      name: file.name || 'document.pdf',
    });
    return apiCall(`/subjects/${subjectId}/exams/${examId}/pdfs`, { method: 'POST', body: formData });
  },
  deletePDF: (subjectId, examId, pdfId) => apiCall(`/subjects/${subjectId}/exams/${examId}/pdfs/${pdfId}`, { method: 'DELETE' }),
  generateExam: (subjectId, examId) => apiCall(`/subjects/${subjectId}/exams/${examId}/generate`, { method: 'POST' }),
  getPDFUrl: (subjectId, examId, pdfId) => `${API_BASE_URL}/subjects/${subjectId}/exams/${examId}/pdfs/${pdfId}`,
};

