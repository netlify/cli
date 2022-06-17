export default async (request, context) => {

  const joke = await fetch("https://icanhazdadjoke.com/", {
    "headers": {
      "Accept": "application/json"
    }
  });
  const jsonData = await joke.json();
  return context.json(jsonData);
};