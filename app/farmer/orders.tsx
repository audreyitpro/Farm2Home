// app/farmer/orders.tsx
// Farm2Home Direct - farmer-specific order management.
// Requires authenticated backend endpoints described in implementation notes.
import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useFocusEffect } from 'expo-router';
import { supabase } from '../data/supabaseClient';
import { enforceSubscriptionAccess } from '../services/lockoutGuard';

const C = { green:'#2E7D32', dark:'#14532D', bg:'#F8FAF5', white:'#FFFFFF', ink:'#172017', muted:'#75806F', border:'#E2E8DA', pale:'#EAF5E6', orange:'#EF6C00', blue:'#1565C0', purple:'#6A1B9A', red:'#DC2626', teal:'#00897B' };
const API_URL = (process.env.EXPO_PUBLIC_API_URL || '').replace(/\/$/, '');
const currency = (n:unknown) => `$${Number(n || 0).toFixed(2)}`;
const norm = (v:unknown) => String(v ?? '').trim().toLowerCase();
const uuid = (v:unknown) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(v ?? ''));

type Method = 'pickup' | 'delivery' | 'shipping';
type Line = { id:string; name:string; quantity:number; unitPrice:number; total:number; category:string };
type Order = {
  id:string; parentId:string; farmerId:string; customerName:string; customerEmail:string;
  customerId:string; farmName:string; createdAt:string; status:string; paymentStatus:string;
  method:Method; address:string; window:string; subtotal:number; deliveryFee:number;
  platformFee:number; farmerPayout:number; carrier:string; trackingNumber:string;
  lines:Line[]; arrival?: {vehicle_make:string; vehicle_model:string; vehicle_color:string|null; parking_location:string|null; arrived_at:string; acknowledged_at:string|null; handed_over_at:string|null};
};
function methodOf(v:unknown):Method { const s=norm(v); return s.includes('ship')?'shipping':s.includes('deliver')?'delivery':'pickup'; }
function paid(v:string) { return ['paid','succeeded','complete','completed'].includes(norm(v)); }
function finished(s:string) { return ['completed','delivered','picked_up','cancelled','canceled','refunded'].includes(norm(s)); }
function isFreight(line:Line) { const s=norm(`${line.name} ${line.category}`); return ['livestock','cattle','cow','goat','pig','sheep','horse','bale','hay'].some(x=>s.includes(x)); }
function statusLabel(v:string) { return (v || 'New').replace(/_/g,' ').toUpperCase(); }
function nextAction(o:Order):{label:string; status:string; color:string}|null {
  const s=norm(o.status);
  if (!paid(o.paymentStatus) || finished(s)) return null;
  if (['pending','paid','new','pending_payment'].includes(s)) return {label:'Received',status:'received',color:C.green};
  if (['received','accepted'].includes(s)) return {label:'Preparing Order',status:'preparing',color:C.orange};
  if (s==='preparing') return o.method==='pickup' ? {label:'Ready for Pickup',status:'ready_for_pickup',color:C.purple} : o.method==='delivery' ? {label:'Out for Delivery',status:'out_for_delivery',color:C.teal} : {label:'Shipping Out Order',status:'shipped',color:C.blue};
  if (['ready_for_pickup','out_for_delivery','in_transit','shipped'].includes(s)) return {label:o.method==='pickup'?'Confirm Pickup':'Mark Completed',status:'completed',color:C.dark};
  return null;
}
function Btn({label,onPress,color=C.green,disabled=false}:{label:string;onPress:()=>void;color?:string;disabled?:boolean}) {
  return <Pressable disabled={disabled} onPress={onPress} style={({pressed})=>[styles.btn,{backgroundColor:disabled?C.muted:color},pressed&&styles.pressed]}><Text style={styles.btnText}>{label}</Text></Pressable>;
}
function SmallBtn({label,onPress}:{label:string;onPress:()=>void}) {
  return <Pressable onPress={onPress} style={({pressed})=>[styles.smallBtn,pressed&&styles.pressed]}><Text style={styles.smallBtnText}>{label}</Text></Pressable>;
}
export default function FarmerOrders() {
  const [orders,setOrders]=useState<Order[]>([]);
  const [farmName,setFarmName]=useState('');
  const [farmerUuid,setFarmerUuid]=useState('');
  const [checking,setChecking]=useState(true);
  const [allowed,setAllowed]=useState(false);
  const [loading,setLoading]=useState(false);
  const [busy,setBusy]=useState('');
  const [expanded,setExpanded]=useState<Record<string,boolean>>({});
  const [tracking,setTracking]=useState<Record<string,{carrier:string;number:string}>>({});
  const [errorMessage,setErrorMessage]=useState('');

  const load = useCallback(async () => {
    setLoading(true); setErrorMessage('');
    try {
      const saved=(await AsyncStorage.getItem('currentFarmer')) || (await AsyncStorage.getItem('currentUser'));
      if (!saved) { setAllowed(false); router.replace('/farmer/login' as any); return; }
      const cached=JSON.parse(saved);
      const {data:{user},error:authError}=await supabase.auth.getUser();
      if (authError || !user) throw new Error('Please sign in to access farmer orders.');
      const {data:farmer,error:farmerError}=await supabase.from('farmers').select('id,auth_user_id,farmer_id,farm_name,email,farmer_email').eq('auth_user_id',user.id).maybeSingle();
      if (farmerError) throw farmerError;
      if (!farmer || !uuid(farmer.id)) throw new Error('No farmer profile is linked to this signed-in account.');
      const access=await enforceSubscriptionAccess({role:'farmer',userId:String(cached.id||farmer.id),email:String(farmer.email||farmer.farmer_email||cached.email||''),redirectTo:'/subscription/subscription-locked'});
      setAllowed(Boolean(access.allowed));
      if (!access.allowed) return;
      setFarmName(String(farmer.farm_name||'Your Farm'));
      setFarmerUuid(String(farmer.id));
      // A farmer's text farmer_id is NOT necessarily farmers.id (UUID).
      // Only query exact identifiers belonging to the authenticated farmer.
      const ids=[String(farmer.id),String(farmer.farmer_id||'')].filter(Boolean);
      const {data:rows,error:ordersError}=await supabase.from('farm_orders').select('id,parent_order_id,customer_order_id,order_id,customer_id,customer_email,customer_name,farmer_id,farmer_name,farm_name,order_status,payment_status,subtotal,delivery_fee,platform_fee,farmer_payout,fulfillment_method,fulfillment_address,fulfillment_window,carrier_name,tracking_number,created_at').in('farmer_id',ids).order('created_at',{ascending:false});
      if (ordersError) throw ordersError;
      const farmRows=rows||[];
      const farmIds=farmRows.map((r:any)=>String(r.id));
      const parentIds=[...new Set(farmRows.flatMap((r:any)=>[r.parent_order_id,r.order_id].filter(Boolean).map(String)))];
      const {data:linked,error:linkedError}=farmIds.length ? await supabase.from('order_items').select('id,order_id,farm_order_id,farmer_id,farmer_name,farmer_email,product_name,quantity,unit_price,total_price').in('farm_order_id',farmIds) : {data:[],error:null};
      // Backward compatibility for items that predate farm_order_id.
      const {data:legacy,error:legacyError}=parentIds.length ? await supabase.from('order_items').select('id,order_id,farm_order_id,farmer_id,farmer_name,farmer_email,product_name,quantity,unit_price,total_price').in('order_id',parentIds) : {data:[],error:null};
      if (linkedError || legacyError) throw linkedError||legacyError;
      const allItems=new Map<string,any>();
      [...(linked||[]),...(legacy||[])].forEach((i:any)=>allItems.set(String(i.id),i));
      const {data:arrivals,error:arrivalError}=farmIds.length ? await supabase.from('farm_order_arrivals').select('farm_order_id,vehicle_make,vehicle_model,vehicle_color,parking_location,arrived_at,acknowledged_at,handed_over_at').in('farm_order_id',farmIds) : {data:[],error:null};
      // Arrival data is only available through an authenticated ownership-checked API or RLS policy.
      // A permissions error is not treated as permission to bypass security.
      if (arrivalError && !['42501','PGRST301'].includes(String(arrivalError.code))) console.warn('Arrival details unavailable:',arrivalError.message);
      const arrivalById=new Map((arrivals||[]).map((a:any)=>[String(a.farm_order_id),a]));
      const result:Order[]=farmRows.map((r:any)=>{
        const lines=[...allItems.values()].filter((i:any)=>{
          if (i.farm_order_id) return String(i.farm_order_id)===String(r.id);
          if (String(i.order_id)!==String(r.parent_order_id||r.order_id)) return false;
          // Legacy matching is only safe with an exact farmer UUID; do not use farm-name equality.
          return String(i.farmer_id||'')===String(farmer.id);
        }).map((i:any)=>({id:String(i.id),name:String(i.product_name||'Farm product'),quantity:Number(i.quantity||0),unitPrice:Number(i.unit_price||0),total:Number(i.total_price??(Number(i.quantity||0)*Number(i.unit_price||0))),category:''}));
        return {id:String(r.id),parentId:String(r.parent_order_id||r.order_id||''),farmerId:String(r.farmer_id||''),customerName:String(r.customer_name||'Customer'),customerEmail:String(r.customer_email||''),customerId:String(r.customer_id||''),farmName:String(r.farm_name||r.farmer_name||farmer.farm_name||''),createdAt:String(r.created_at||''),status:String(r.order_status||'paid'),paymentStatus:String(r.payment_status||''),method:methodOf(r.fulfillment_method),address:String(r.fulfillment_address||''),window:String(r.fulfillment_window||''),subtotal:Number(r.subtotal||0),deliveryFee:Number(r.delivery_fee||0),platformFee:Number(r.platform_fee??(Number(r.subtotal||0)*0.04)),farmerPayout:Number(r.farmer_payout??(Number(r.subtotal||0)*0.96)),carrier:String(r.carrier_name||''),trackingNumber:String(r.tracking_number||''),lines,arrival:arrivalById.get(String(r.id))};
      });
      setOrders(result);
    } catch(e:any) { setOrders([]); setErrorMessage(e?.message||'Unable to load orders.'); }
    finally { setLoading(false); setChecking(false); }
  },[]);
  useFocusEffect(useCallback(()=>{void load();},[load]));

  async function authenticatedPost(path:string,body:Record<string,unknown>) {
    if (!API_URL) throw new Error('EXPO_PUBLIC_API_URL is missing. Configure your backend URL first.');
    const {data:{session}}=await supabase.auth.getSession();
    if (!session?.access_token) throw new Error('Please sign in again.');
    const response=await fetch(`${API_URL}${path}`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${session.access_token}`},body:JSON.stringify(body)});
    const json=await response.json().catch(()=>({}));
    if (!response.ok || json?.success===false) throw new Error(json?.error||`Request failed (${response.status})`);
    return json;
  }
  async function changeStatus(o:Order,status:string) {
    if (busy) return;
    if (!paid(o.paymentStatus)) {Alert.alert('Payment pending','Only paid orders can be fulfilled.');return;}
    const execute=async()=>{
      setBusy(o.id);
      try {
        const shipment=tracking[o.id]||{carrier:o.carrier,number:o.trackingNumber};
        if(status==='shipped'&&(!shipment.carrier.trim()||!shipment.number.trim())) throw new Error('Enter the shipping carrier and tracking number first.');
        await authenticatedPost('/payments/farm-orders/status',{farmOrderId:o.id,status,...(status==='shipped'?{carrierName:shipment.carrier.trim(),trackingNumber:shipment.number.trim()}:{})});
        await load(); Alert.alert('Order updated',`Order marked ${statusLabel(status)}. Customer notification queued by backend.`);
      } catch(e:any){Alert.alert('Update failed',e?.message||'Please try again.');}
      finally {setBusy('');}
    };
    Alert.alert('Confirm status',`Change order #${o.id.slice(-8)} to ${statusLabel(status)}?`,[{text:'Cancel',style:'cancel'},{text:'Confirm',onPress:()=>{void execute();}}]);
  }
  async function acknowledgeArrival(o:Order) {
    setBusy(o.id);
    try {await authenticatedPost('/payments/farm-orders/arrival/acknowledge',{farmOrderId:o.id});await load();Alert.alert('Customer notified','Arrival acknowledged.');}
    catch(e:any){Alert.alert('Unable to acknowledge',e?.message||'Try again.');}
    finally{setBusy('');}
  }
  async function postDriver(o:Order) {
    setBusy(o.id);
    try {await authenticatedPost('/payments/farm-orders/driver-board',{farmOrderId:o.id});Alert.alert('Posted','Delivery request sent to the driver board.');}
    catch(e:any){Alert.alert('Unable to post',e?.message||'Try again.');}
    finally{setBusy('');}
  }
  async function createFreight(o:Order) {
    setBusy(o.id);
    try {await authenticatedPost('/payments/farm-orders/freight',{farmOrderId:o.id});Alert.alert('Freight load created','The freight load is available in your freight workflow.');}
    catch(e:any){Alert.alert('Unable to create freight load',e?.message||'Try again.');}
    finally{setBusy('');}
  }
  function navigate(pathname:string,o:Order,extra:Record<string,string>={}) {router.push({pathname:pathname as any,params:{orderId:o.parentId||o.id,farmOrderId:o.id,farmerId:farmerUuid,...extra}} as any);}
  const stats=useMemo(()=>({total:orders.length,active:orders.filter(o=>!finished(o.status)).length,revenue:orders.filter(o=>paid(o.paymentStatus)).reduce((s,o)=>s+o.subtotal,0)}),[orders]);
  if(checking) return <View style={styles.center}><ActivityIndicator size="large" color={C.green}/><Text style={styles.muted}>Checking farmer access...</Text></View>;
  if(!allowed) return <View style={styles.center}><Text style={styles.heading}>Farmer access required</Text><Text style={styles.muted}>{errorMessage||'Redirecting to subscription access.'}</Text><Btn label="Retry" onPress={()=>void load()}/></View>;
  return <View style={styles.page}>
    <FlatList data={orders} keyExtractor={o=>o.id} refreshControl={<RefreshControl refreshing={loading} onRefresh={()=>void load()} tintColor={C.green}/>} contentContainerStyle={styles.list}
      ListHeaderComponent={<View>
        <View style={styles.top}><SmallBtn label="‹ Back" onPress={()=>router.replace('/farmer/dashboard' as any)}/><View style={{flex:1}}><Text style={styles.heading}>Farmer Orders</Text><Text style={styles.muted}>{farmName}</Text></View></View>
        <View style={styles.hero}><Text style={styles.heroTitle}>Manage customer fulfillment</Text><Text style={styles.heroText}>Confirm orders, prepare products, coordinate pickup, delivery or shipping, and view your farm-specific earnings.</Text></View>
        <View style={styles.stats}><View style={styles.stat}><Text style={styles.statValue}>{stats.total}</Text><Text style={styles.muted}>Total</Text></View><View style={styles.stat}><Text style={styles.statValue}>{stats.active}</Text><Text style={styles.muted}>Active</Text></View><View style={styles.stat}><Text style={styles.statValue}>{currency(stats.revenue)}</Text><Text style={styles.muted}>Farm sales</Text></View></View>
        {!!errorMessage&&<View style={styles.warning}><Text style={styles.warningText}>{errorMessage}</Text><SmallBtn label="Retry" onPress={()=>void load()}/></View>}
      </View>}
      ListEmptyComponent={!loading?<View style={styles.card}><Text style={styles.heading}>No farm orders yet</Text><Text style={styles.muted}>Paid orders assigned to this farmer will appear here. Existing orders may require the checkout-to-farm_orders migration.</Text></View>:null}
      renderItem={({item:o})=>{const detail=Boolean(expanded[o.id]);const action=nextAction(o);const freight=o.lines.some(isFreight);const ship=tracking[o.id]||{carrier:o.carrier,number:o.trackingNumber};return <View style={styles.card}>
        <View style={styles.cardTop}><View style={{flex:1}}><Text style={styles.orderTitle}>Order #{o.id.slice(-8).toUpperCase()}</Text><Text style={styles.muted}>{o.createdAt?new Date(o.createdAt).toLocaleString():'Date unavailable'}</Text></View><View style={styles.pill}><Text style={styles.pillText}>{statusLabel(o.status)}</Text></View></View>
        <Text style={styles.customer}>{o.customerName||o.customerEmail}</Text><Text style={styles.muted}>Fulfillment: {o.method.toUpperCase()} · Payment: {statusLabel(o.paymentStatus)}</Text>
        <View style={styles.amount}><Text style={styles.amountText}>Farm subtotal</Text><Text style={styles.amountValue}>{currency(o.subtotal)}</Text></View>
        <SmallBtn label={detail?'Hide Order Breakdown':'View Order Breakdown'} onPress={()=>setExpanded(s=>({...s,[o.id]:!s[o.id]}))}/>
        {detail&&<View style={styles.details}>
          <Text style={styles.section}>Products from this farm</Text>
          {o.lines.length===0?<Text style={styles.warningText}>Item details are not linked to this farm order yet. Do not fulfill until the order is verified.</Text>:o.lines.map(l=><View key={l.id} style={styles.line}><View style={{flex:1}}><Text style={styles.bold}>{l.name}</Text><Text style={styles.muted}>Qty {l.quantity} × {currency(l.unitPrice)}</Text></View><Text style={styles.bold}>{currency(l.total)}</Text></View>)}
          <View style={styles.line}><Text style={styles.muted}>Product subtotal</Text><Text style={styles.bold}>{currency(o.subtotal)}</Text></View>
          <View style={styles.line}><Text style={styles.muted}>Platform commission (4%)</Text><Text style={styles.bold}>−{currency(o.platformFee)}</Text></View>
          <View style={styles.line}><Text style={styles.bold}>Estimated farmer payout</Text><Text style={styles.payout}>{currency(o.farmerPayout)}</Text></View>
          <Text style={styles.note}>The customer's $4.99 checkout service fee is charged once on the combined parent order, not once per farmer.</Text>
          {!!o.window&&<Text style={styles.info}>Fulfillment window: {o.window}</Text>}
          {!!o.address&&<Text style={styles.info}>{o.method==='pickup'?'Pickup location':'Fulfillment address'}: {o.address}</Text>}
          {o.method==='shipping'&&!!o.trackingNumber&&<Text style={styles.info}>Tracking: {o.carrier} {o.trackingNumber}</Text>}
        </View>}
        {o.arrival&&<View style={styles.arrival}><Text style={styles.section}>Customer is outside</Text><Text style={styles.info}>{[o.arrival.vehicle_color,o.arrival.vehicle_make,o.arrival.vehicle_model].filter(Boolean).join(' ')}</Text><Text style={styles.info}>Parking: {o.arrival.parking_location||'Not specified'}</Text><Text style={styles.muted}>Arrived: {new Date(o.arrival.arrived_at).toLocaleString()}</Text>{!o.arrival.acknowledged_at&&<Btn label="Acknowledge Customer Arrival" color={C.teal} disabled={busy===o.id} onPress={()=>void acknowledgeArrival(o)}/>}</View>}
        {o.method==='shipping'&&norm(o.status)==='preparing'&&<View style={styles.details}><Text style={styles.section}>Shipping information</Text><TextInput style={styles.input} placeholder="Carrier (USPS, UPS, FedEx...)" value={ship.carrier} onChangeText={v=>setTracking(s=>({...s,[o.id]:{...ship,carrier:v}}))}/><TextInput style={styles.input} placeholder="Tracking number" value={ship.number} onChangeText={v=>setTracking(s=>({...s,[o.id]:{...ship,number:v}}))}/></View>}
        <View style={styles.actions}><SmallBtn label="Customer Chat" onPress={()=>navigate('/chat/chat-center',o,{conversationId:`order_${o.parentId||o.id}`,role:'farmer'})}/><SmallBtn label="Driver Chat" onPress={()=>navigate('/farmer/driver-chat',o)}/><SmallBtn label="Monitor Chat" onPress={()=>navigate('/farmer/customer-driver-chat',o)}/><SmallBtn label="Tracking" onPress={()=>navigate('/customer/order-tracking',o)}/></View>
        {o.method==='delivery'&&<Btn label="Post to Driver Board" color={C.blue} disabled={busy===o.id} onPress={()=>void postDriver(o)}/>}
        {freight&&<Btn label="Create Freight Load" color={C.dark} disabled={busy===o.id} onPress={()=>void createFreight(o)}/>}
        {action&&<Btn label={busy===o.id?'Updating...':action.label} color={action.color} disabled={busy===o.id||!o.lines.length} onPress={()=>void changeStatus(o,action.status)}/>}
        {!o.lines.length&&<Text style={styles.note}>Status changes are disabled until the purchased items are linked to this farm order.</Text>}
      </View>;}}
    />
    <View style={styles.footer}><Btn label="Back to Farmer Dashboard" color={C.dark} onPress={()=>router.replace('/farmer/dashboard' as any)}/></View>
  </View>;
}
const styles=StyleSheet.create({
  page:{flex:1,backgroundColor:C.bg},center:{flex:1,alignItems:'center',justifyContent:'center',padding:22,gap:12,backgroundColor:C.bg},list:{padding:16,paddingBottom:24},top:{flexDirection:'row',alignItems:'center',gap:12,marginBottom:16},heading:{fontSize:25,fontWeight:'900',color:C.ink},muted:{color:C.muted,fontSize:12,marginTop:3},hero:{backgroundColor:C.green,borderRadius:18,padding:18,marginBottom:14},heroTitle:{fontSize:23,fontWeight:'900',color:C.white},heroText:{color:'#EAF7E6',fontSize:13,lineHeight:20,marginTop:8},stats:{flexDirection:'row',gap:8,marginBottom:14},stat:{flex:1,backgroundColor:C.white,borderWidth:1,borderColor:C.border,borderRadius:14,padding:12},statValue:{fontWeight:'900',color:C.green,fontSize:18},card:{backgroundColor:C.white,borderWidth:1,borderColor:C.border,borderRadius:18,padding:16,marginBottom:14,gap:10},cardTop:{flexDirection:'row',alignItems:'center',gap:10},orderTitle:{fontSize:17,fontWeight:'900',color:C.ink},pill:{backgroundColor:C.pale,borderRadius:20,paddingHorizontal:10,paddingVertical:7},pillText:{fontSize:10,fontWeight:'900',color:C.dark},customer:{fontSize:15,fontWeight:'900',color:C.ink},amount:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',borderTopWidth:1,borderTopColor:C.border,paddingTop:12},amountText:{fontWeight:'800',color:C.muted},amountValue:{fontWeight:'900',fontSize:20,color:C.green},details:{backgroundColor:'#F4FAF1',borderRadius:12,padding:12,gap:9},section:{fontSize:15,fontWeight:'900',color:C.ink},line:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',gap:10,paddingVertical:5,borderBottomWidth:1,borderBottomColor:C.border},bold:{fontWeight:'800',color:C.ink},payout:{fontSize:17,fontWeight:'900',color:C.green},info:{fontWeight:'600',color:C.ink,fontSize:13,lineHeight:20},note:{fontSize:12,color:C.muted,lineHeight:18},actions:{flexDirection:'row',flexWrap:'wrap',gap:7,marginTop:4},btn:{padding:13,borderRadius:12,alignItems:'center',justifyContent:'center',marginTop:5},btnText:{fontSize:13,fontWeight:'900',color:C.white,textAlign:'center'},smallBtn:{borderWidth:1,borderColor:C.border,backgroundColor:C.pale,paddingHorizontal:12,paddingVertical:10,borderRadius:11,alignSelf:'flex-start'},smallBtnText:{fontSize:12,fontWeight:'900',color:C.green},pressed:{opacity:0.7},arrival:{backgroundColor:'#EFF6FF',padding:12,borderRadius:12,gap:6},input:{backgroundColor:C.white,borderColor:C.border,borderWidth:1,borderRadius:10,padding:12,fontSize:14,color:C.ink},footer:{paddingHorizontal:16,paddingBottom:18,backgroundColor:C.bg},warning:{padding:12,backgroundColor:'#FFF7ED',borderRadius:12,marginBottom:12,gap:8},warningText:{color:'#9A3412',fontWeight:'700',lineHeight:19,fontSize:13}
});
