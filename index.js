require("dotenv").config(); // dotenv 패키지를 사용해 환경 변수 로드
const axios = require("axios");
const cron = require("node-cron");

const shopifyGraphQL = async (query) => {
  try {
    const response = await axios.post(
      process.env.SHOPTIFY_STORE_URL,
      { query },
      {
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": process.env.SHOPIFY_ACCESS_TOKEN,
        },
      }
    );

    return response.data;
  } catch (error) {
    console.error("Error occurred while making a Shopify API call:", error);
  }
};

//TASK 1
const getProductQuery = `
  {
    products(first: 1, query: "title:Ala Artemis - 3280 - Seolhee") {
      edges {
        node {
          id
          title
        }
      }
    }
  }
`;

const metafieldUpdateMutation = (productId) => `
  mutation {
    productUpdate(input: {
      id: "${productId}",
      metafields: [
        {
          namespace: "custom",
          key: "firmess",
          value: "Extra Firm",
          type: "single_line_text_field"
        }
      ]
    }) {
      product {
        id
      }
      userErrors {
        field
        message
      }
    }
  }
`;

shopifyGraphQL(getProductQuery).then((data) => {
  const productId = data.data.products.edges[0].node.id;
  console.log("Product ID:", productId);

  shopifyGraphQL(metafieldUpdateMutation(productId)).then((updateData) => {
    console.log("Metafield Updated:", updateData);

    if (updateData.data.productUpdate.userErrors.length > 0) {
      console.error(
        "Metafield Update Error:",
        updateData.data.productUpdate.userErrors
      );
    } else {
      console.log("Metafield Update Successful");
    }
  });
});

//TASK 2
const getNectarProductsQuery = `
  {
    products(first: 50, query: "vendor:Nectar") {
      edges {
        node {
          id
          title
          variants(first: 50) {
            edges {
              node {
                id
                inventoryItem {
                  inventoryLevels(first: 1) {
                    edges {
                      node {
                        id
                        available
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
`;

const inventoryUpdateMutation = (inventoryLevelId) => `
  mutation {
    inventoryAdjustQuantity(input: {
      inventoryLevelId: "${inventoryLevelId}",
      availableDelta: 1
    }) {
      inventoryLevel {
        available
      }
      userErrors {
        field
        message
      }
    }
  }
`;

const updateNectarProductInventory = () => {
  shopifyGraphQL(getNectarProductsQuery)
    .then((data) => {
      if (data && data.data && data.data.products) {
        const products = data.data.products.edges;

        products.forEach((product) => {
          product.node.variants.edges.forEach((variant) => {
            const inventoryLevel =
              variant.node.inventoryItem.inventoryLevels.edges[0].node;
            const inventoryLevelId = inventoryLevel.id;

            console.log(`Updating Inventory Level ID: ${inventoryLevelId}`);

            shopifyGraphQL(inventoryUpdateMutation(inventoryLevelId)).then(
              (updateData) => {
                if (
                  updateData.data.inventoryAdjustQuantity.userErrors.length > 0
                ) {
                  console.error(
                    "Inventory Update Error:",
                    updateData.data.inventoryAdjustQuantity.userErrors
                  );
                } else {
                  console.log(
                    `Inventory Updated for ${product.node.title}:`,
                    updateData.data.inventoryAdjustQuantity.inventoryLevel
                      .available
                  );
                }
              }
            );
          });
        });
      } else {
        console.error("No products found for vendor: Nectar");
      }
    })
    .catch((error) => {
      console.error("Error fetching products:", error);
    });
};

cron.schedule("0 * * * *", () => {
  console.log("Running scheduled inventory update...");
  updateNectarProductInventory();
});
