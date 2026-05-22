const text1 = "Hola, mundo. Este es un texto con: comas, puntos y dos puntos!";
const regex = /[.,\/#!$%\^&\*;:{}=\-_`~()¡!¿?:;"'|\[\]\u2013\u2014]/g;
console.log(text1.replace(regex, ''));
