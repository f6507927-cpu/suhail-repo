// Ban direct formatting, including optional and statically computed members.
function memberName(node) {
  if (!node.computed && node.property.type === "Identifier") return node.property.name;
  function text(value) {
    if (value.type === "Literal") return value.value;
    if (value.type === "TemplateLiteral" && value.expressions.length === 0)
      return value.quasis[0].value.cooked;
    if (value.type === "BinaryExpression" && value.operator === "+") {
      const a = text(value.left), b = text(value.right);
      if (typeof a === "string" && typeof b === "string") return a + b;
    }
  }
  return text(node.property);
}

const formatting = {
  rules: {
    shared: {
      meta: {
        type: "problem",
        schema: [],
        messages: { shared: "Use src/lib/format.ts for date and number formatting (D-121)." },
      },
      create(context) {
        return {
          MemberExpression(node) {
            if (["DateTimeFormat", "toLocaleDateString", "toLocaleString", "toLocaleTimeString"].includes(memberName(node)))
              context.report({ node, messageId: "shared" });
          },
        };
      },
    },
  },
};
export default formatting;
