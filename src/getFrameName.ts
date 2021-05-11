export const getFrameName = (name: string, id: string) => {
  return `${name}-${id.replace(":", "0")}`;
};
