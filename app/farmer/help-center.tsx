import { ScrollView, Text, View, TouchableOpacity, StyleSheet, Linking } from "react-native";

const resources = [
  {
    category: "Fresh Produce",
    form: "Produce Safety Certificate",
    how: "Complete food safety farm practices training.",
    submit: "Submit to Michigan Department of Agriculture.",
    url: "https://www.michigan.gov/mdard",
  },
  {
    category: "Eggs",
    form: "Egg Sales License",
    how: "Register egg washing, labeling, packaging standards.",
    submit: "Submit to Michigan Agriculture Licensing Division.",
    url: "https://www.michigan.gov/mdard",
  },
  {
    category: "Meat",
    form: "USDA / State Meat Processing Approval",
    how: "Use approved slaughter/processing facility.",
    submit: "USDA or state inspection office.",
    url: "https://www.fsis.usda.gov",
  },
  {
    category: "Honey",
    form: "Food Label Compliance",
    how: "Create ingredient label and net weight labeling.",
    submit: "Local agriculture / cottage food office.",
    url: "https://www.fda.gov/food",
  },
  {
    category: "Livestock",
    form: "Animal Health Certificate",
    how: "Licensed veterinarian inspection required.",
    submit: "State agriculture department.",
    url: "https://www.aphis.usda.gov",
  }
];

export default function HelpCenter() {
  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <Text style={styles.header}>📚 Farmer Help Center</Text>

      <Text style={styles.subheader}>
        Learn what forms you need, how to complete them, and where to submit.
      </Text>

      {resources.map((item, index) => (
        <View key={index} style={styles.card}>
          <Text style={styles.title}>{item.category}</Text>

          <Text style={styles.label}>Required Form:</Text>
          <Text style={styles.text}>{item.form}</Text>

          <Text style={styles.label}>How To Complete:</Text>
          <Text style={styles.text}>{item.how}</Text>

          <Text style={styles.label}>Where To Submit:</Text>
          <Text style={styles.text}>{item.submit}</Text>

          <TouchableOpacity
            style={styles.button}
            onPress={() => Linking.openURL(item.url)}
          >
            <Text style={styles.buttonText}>Open Official Website</Text>
          </TouchableOpacity>
        </View>
      ))}

      <View style={styles.aiBox}>
        <Text style={styles.aiTitle}>🤖 AI Assistance Coming Next</Text>
        <Text style={styles.aiText}>
          Farm2Home can later auto-check uploaded forms and tell farmers what is missing.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page:{flex:1,backgroundColor:"#f5f8f2"},
  content:{padding:18,paddingBottom:40},
  header:{fontSize:28,fontWeight:"bold",color:"#2f7d32"},
  subheader:{marginTop:8,color:"#555",marginBottom:20,fontSize:15},
  card:{
    backgroundColor:"white",
    padding:16,
    borderRadius:16,
    marginBottom:14,
    borderWidth:1,
    borderColor:"#ddd"
  },
  title:{fontSize:20,fontWeight:"bold",marginBottom:10,color:"#222"},
  label:{fontWeight:"bold",marginTop:8,color:"#2f7d32"},
  text:{color:"#444",marginTop:3},
  button:{
    marginTop:14,
    backgroundColor:"#2f7d32",
    padding:13,
    borderRadius:12
  },
  buttonText:{
    color:"white",
    textAlign:"center",
    fontWeight:"bold"
  },
  aiBox:{
    backgroundColor:"#e8f5e9",
    padding:15,
    borderRadius:14,
    marginTop:10
  },
  aiTitle:{fontWeight:"bold",color:"#2f7d32"},
  aiText:{marginTop:5,color:"#444"}
});