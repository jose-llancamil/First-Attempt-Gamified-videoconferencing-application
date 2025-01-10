function safeJSONParse(data, fieldName) {
    try {
      if (!data || data === '') {
        return [];
      }
      return JSON.parse(data);
    } catch (error) {
      console.error(`Error al parsear el campo ${fieldName}:`, error);
      throw new Error(`El campo ${fieldName} contiene datos no válidos.`);
    }
  }
  
  function validateSerializableAsJSON(data, fieldName) {
    try {
      JSON.stringify(data);
    } catch (error) {
      console.error(`Error al serializar el campo ${fieldName}:`, error);
      throw new Error(`El campo ${fieldName} contiene datos no serializables.`);
    }
  }

export { safeJSONParse, validateSerializableAsJSON };