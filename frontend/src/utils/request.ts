import axios, { type AxiosInstance, type AxiosRequestConfig, type AxiosResponse } from 'axios'
import message from '../components/msg'

// Create axios instance
const request: AxiosInstance = axios.create({
  baseURL: '/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor - add token to headers
request.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Response interceptor - handle errors globally
request.interceptors.response.use(
  (response: AxiosResponse) => {
    const { code, msg } = response.data
    
    // If the response is not in the standard format, return as is
    if (code === undefined) {
      return response
    }

    if (code !== 0) {
      message.error(msg || '请求失败')
      return Promise.reject(new Error(msg || '请求失败'))
    }

    // Return the response data (which contains code, data, msg)
    return response.data
  },
  (error) => {
    if (error.response) {
      const { data } = error.response
      
      // Handle specific error codes if they follow standard format
      if (data && data.code === 40101) {
        // Token expired
        localStorage.removeItem('token')
        if (window.location.pathname !== '/login') {
          window.location.href = '/login'
        }
        return Promise.reject(new Error(data.msg || '登录已过期'))
      }

      if (data && data.msg) {
        message.error(data.msg)
      } else {
        // Handle specific error codes
        switch (error.response.status) {
          case 401:
            // Unauthorized (other than expired, like missing or invalid)
            // Just show message, don't necessarily clear token automatically 
            // unless we're sure we want to force logout on any 401
            message.error('未经授权，请登录')
            break
          case 403:
            message.error('无权访问')
            break
          case 404:
            message.error('资源不存在')
            break
          case 500:
            message.error('服务器内部错误')
            break
          default:
            message.error('网络请求失败')
        }
      }
    } else {
      message.error('网络连接超时或断开')
    }
    return Promise.reject(error)
  }
)

export default request
