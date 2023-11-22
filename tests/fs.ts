import mock from 'mock-fs'

let toMock = {}

export const addMockedFiles = (args: any) => {
  toMock = { ...toMock, ...args }
}

export const mockFiles = () => {
  mock(toMock)
}

export const clearMockedFiles = () => {
  toMock = {}
}
