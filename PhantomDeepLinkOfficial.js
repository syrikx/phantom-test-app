import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Linking,
  ScrollView,
  TextInput,
} from 'react-native';
import bs58 from 'bs58';
import nacl from 'tweetnacl';
import { clusterApiUrl, Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';

const PHANTOM_BASE_URL = 'https://phantom.app/ul/v1';

export default function PhantomDeepLinkOfficial() {
  const [dAppKeyPair] = useState(nacl.box.keyPair());
  const [sharedSecret, setSharedSecret] = useState();
  const [session, setSession] = useState(null);
  const [phantomWalletPublicKey, setPhantomWalletPublicKey] = useState(null);
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    const handleDeepLink = (urlParam) => {
      // Handle different URL parameter formats
      let url = urlParam;
      
      // If it's an event object, extract the URL
      if (typeof urlParam === 'object' && urlParam !== null) {
        if (urlParam.url) {
          url = urlParam.url;
          addLog(`📎 Extracted URL from event object: ${url}`);
        } else {
          addLog(`❌ Invalid URL object received: ${JSON.stringify(urlParam)}`);
          return;
        }
      }
      
      // Ensure url is a string
      if (!url || typeof url !== 'string') {
        addLog(`❌ Invalid URL received: ${typeof url} - ${url}`);
        return;
      }
      
      addLog(`📥 Received deep link: ${url}`);
      
      try {
        // Handle different URL formats
        let urlObject;
        if (url.includes('?')) {
          urlObject = new URL(url);
        } else {
          // Handle URLs without query parameters
          const [scheme, path] = url.split('://');
          urlObject = { searchParams: new URLSearchParams() };
          addLog(`📍 Simple deep link detected: ${scheme}://${path}`);
        }
        
        const params = urlObject.searchParams;
        
        // Check for error response first
        if (params.get('errorCode')) {
          const errorCode = params.get('errorCode');
          const errorMessage = params.get('errorMessage') || 'Unknown error';
          addLog(`❌ Phantom Error [${errorCode}]: ${errorMessage}`);
          Alert.alert('Phantom 오류', `오류 코드: ${errorCode}\n${errorMessage}`);
          return;
        }

        // Handle initial connection response
        if (params.get('phantom_encryption_public_key') && params.get('nonce')) {
          addLog('🔐 Processing connection response...');
          try {
            const phantomPublicKeyParam = params.get('phantom_encryption_public_key');
            const nonceParam = params.get('nonce');
            
            addLog(`🔑 Phantom public key: ${phantomPublicKeyParam.slice(0, 20)}...`);
            addLog(`🎲 Nonce: ${nonceParam.slice(0, 20)}...`);
            
            const phantomPublicKey = bs58.decode(phantomPublicKeyParam);
            
            // Create shared secret for future encrypted communication
            const sharedSecretDapp = nacl.box.before(phantomPublicKey, dAppKeyPair.secretKey);
            setSharedSecret(sharedSecretDapp);
            addLog('✅ Shared secret established');

            // Decrypt connection data if present
            const connectData = params.get('data');
            if (connectData) {
              addLog('🔓 Decrypting connection data...');
              const decryptedData = decryptPayload(connectData, nonceParam, sharedSecretDapp);
              if (decryptedData?.public_key) {
                setPhantomWalletPublicKey(decryptedData.public_key);
                setSession({
                  phantomEncryptionPublicKey: phantomPublicKeyParam,
                  nonce: nonceParam,
                });
                addLog(`🎉 Successfully connected to wallet: ${decryptedData.public_key.slice(0, 20)}...`);
                Alert.alert('연결 성공!', `지갑이 성공적으로 연결되었습니다.\n\n공개키: ${decryptedData.public_key.slice(0, 20)}...`);
              }
            } else {
              addLog('⚠️ No connection data found in response');
            }
          } catch (keyError) {
            addLog(`❌ Key processing error: ${keyError.message}`);
          }
        }
        // Handle encrypted responses (signatures, transactions)
        else if (params.get('data') && params.get('nonce') && sharedSecret) {
          addLog('🔓 Decrypting response data...');
          const decryptedData = decryptPayload(params.get('data'), params.get('nonce'), sharedSecret);
          if (decryptedData) {
            handleConnectResponse(decryptedData);
          }
        }
        else {
          addLog('⚠️ Received deep link with unexpected format');
          addLog(`📋 Available params: ${Array.from(params.entries()).map(([k,v]) => `${k}=${v?.slice(0,20)}...`).join(', ')}`);
        }
      } catch (error) {
        addLog(`❌ Deep link parsing failed: ${error.message}`);
        Alert.alert('링크 오류', `Deep link 처리 중 오류가 발생했습니다: ${error.message}`);
      }
    };

    const subscription = Linking.addEventListener('url', handleDeepLink);
    
    // Check if app was opened via deep link
    Linking.getInitialURL().then(url => {
      if (url && typeof url === 'string') {
        addLog('🚀 App opened with initial URL');
        handleDeepLink(url);
      } else if (url) {
        addLog(`❌ Invalid initial URL type: ${typeof url}`);
      }
    }).catch(error => {
      addLog(`❌ Error getting initial URL: ${error.message}`);
    });

    return () => {
      subscription?.remove();
      addLog('📱 Deep link listener removed');
    };
  }, [sharedSecret, dAppKeyPair]);

  const addLog = (message) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, `${timestamp}: ${message}`]);
  };

  // Helper function to create redirect URL with fallback
  const createRedirectUrl = (path = 'onPhantomConnected') => {
    let redirectUrl;
    
    try {
      redirectUrl = Linking.createURL(path);
      addLog(`🔗 Generated redirect URL: ${redirectUrl}`);
    } catch (error) {
      addLog(`⚠️ Linking.createURL failed: ${error.message}`);
      redirectUrl = `phantomtestapp://${path}`;
      addLog(`🔄 Using fallback redirect URL: ${redirectUrl}`);
    }

    // Handle development mode (exp:// URLs)
    if (redirectUrl.includes('exp://')) {
      addLog('🧪 Development mode detected - adjusting redirect URL');
      redirectUrl = `phantomtestapp://${path}`;
      addLog(`🔄 Dev-friendly URL: ${redirectUrl}`);
    }

    return redirectUrl;
  };

  const buildUrl = (path, params) => {
    const url = new URL(`${PHANTOM_BASE_URL}/${path}`);
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });
    return url.toString();
  };

  const encryptPayload = (payload, sharedSecret) => {
    if (!sharedSecret) throw new Error('missing shared secret');

    const nonce = nacl.randomBytes(24);
    const encryptedPayload = nacl.box.after(
      Buffer.from(JSON.stringify(payload)),
      nonce,
      sharedSecret,
    );

    return [nonce, encryptedPayload];
  };

  const decryptPayload = (data, nonce, sharedSecret) => {
    if (!sharedSecret) throw new Error('missing shared secret');

    try {
      const decryptedData = nacl.box.open.after(
        bs58.decode(data),
        bs58.decode(nonce),
        sharedSecret,
      );
      
      if (!decryptedData) {
        throw new Error('Unable to decrypt data');
      }
      
      return JSON.parse(Buffer.from(decryptedData).toString('utf8'));
    } catch (error) {
      addLog(`❌ Decryption failed: ${error.message}`);
      return null;
    }
  };

  const handleConnectResponse = (data) => {
    if (data.public_key) {
      setPhantomWalletPublicKey(data.public_key);
      addLog(`✅ Connected to wallet: ${data.public_key.slice(0, 20)}...`);
    }
    if (data.signature) {
      addLog(`✅ Message signed: ${data.signature.slice(0, 20)}...`);
    }
    if (data.transaction) {
      addLog(`✅ Transaction sent: ${data.transaction.slice(0, 20)}...`);
    }
  };

  const connect = async () => {
    const redirectUrl = createRedirectUrl('onPhantomConnected');
    
    const params = {
      dapp_encryption_public_key: bs58.encode(dAppKeyPair.publicKey),
      cluster: 'devnet',
      app_url: 'https://phantom.app',
      redirect_link: redirectUrl,
    };

    const url = buildUrl('connect', params);
    addLog('🔗 Connecting to Phantom...');
    addLog(`📱 Opening URL: ${url}`);
    
    try {
      await Linking.openURL(url);
      // const supported = await Linking.canOpenURL(url);
      // if (supported) {        
      //   addLog('✅ URL opened successfully');
      // } else {
      //   addLog('❌ Cannot open Phantom URL');
      //   Alert.alert(
      //     'Phantom 앱 필요', 
      //     'Phantom 지갑 앱이 설치되어 있지 않거나 업데이트가 필요합니다.\n\n앱 스토어에서 Phantom 앱을 설치해주세요.',
      //     [
      //       { text: '취소', style: 'cancel' },
      //       { text: '앱 스토어 열기', onPress: () => Linking.openURL('https://phantom.app/download') }
      //     ]
      //   );
      // }
    } catch (error) {
      addLog(`❌ Connection failed: ${error.message}`);
      Alert.alert('연결 오류', `Phantom 연결에 실패했습니다: ${error.message}`);
    }
  };

  const disconnect = async () => {
    if (!phantomWalletPublicKey) {
      Alert.alert('오류', '연결된 지갑이 없습니다.');
      return;
    }

    const redirectUrl = createRedirectUrl('onPhantomConnected');

    const params = {
      dapp_encryption_public_key: bs58.encode(dAppKeyPair.publicKey),
      redirect_link: redirectUrl,
    };

    const url = buildUrl('disconnect', params);
    addLog('🔌 Disconnecting...');
    
    try {
      await Linking.openURL(url);
      setPhantomWalletPublicKey(null);
      setSession(null);
      setSharedSecret(null);
    } catch (error) {
      addLog(`❌ Disconnect failed: ${error.message}`);
    }
  };

  const signMessage = async () => {
    if (!phantomWalletPublicKey || !sharedSecret) {
      Alert.alert('오류', '먼저 Phantom 지갑을 연결해주세요.');
      return;
    }

    const message = 'Hello from Phantom Deep Link Demo!';
    const payload = {
      message: bs58.encode(Buffer.from(message, 'utf8')),
    };

    try {
      const [nonce, encryptedPayload] = encryptPayload(payload, sharedSecret);
      
      const params = {
        dapp_encryption_public_key: bs58.encode(dAppKeyPair.publicKey),
        nonce: bs58.encode(nonce),
        redirect_link: createRedirectUrl('onPhantomConnected'),
        payload: bs58.encode(encryptedPayload),
      };

      const url = buildUrl('signMessage', params);
      addLog('✍️ Signing message...');
      await Linking.openURL(url);
    } catch (error) {
      addLog(`❌ Sign message failed: ${error.message}`);
    }
  };

  const signAndSendTransaction = async () => {
    if (!phantomWalletPublicKey || !sharedSecret) {
      Alert.alert('오류', '먼저 Phantom 지갑을 연결해주세요.');
      return;
    }

    try {
      addLog('🔄 Creating transaction...');
      const connection = new Connection(clusterApiUrl('devnet'));
      const fromPubkey = new PublicKey(phantomWalletPublicKey);
      
      // Create a simple transfer transaction (sending to self to avoid losing funds)
      const toPubkey = fromPubkey; // Send to self for testing
      const lamports = 1000; // 0.000001 SOL
      
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey,
          toPubkey,
          lamports,
        })
      );

      // Get latest blockhash with commitment
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('finalized');
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = fromPubkey;
      
      addLog(`💡 Transaction created with blockhash: ${blockhash.slice(0, 20)}...`);
      addLog(`💰 Transfer amount: ${lamports / LAMPORTS_PER_SOL} SOL`);

      const serializedTransaction = transaction.serialize({
        requireAllSignatures: false,
      });

      const payload = {
        transaction: bs58.encode(serializedTransaction),
        message: 'Test transaction: Transfer 0.000001 SOL to self',
      };

      addLog('🔐 Encrypting transaction payload...');
      const [nonce, encryptedPayload] = encryptPayload(payload, sharedSecret);
      
      const params = {
        dapp_encryption_public_key: bs58.encode(dAppKeyPair.publicKey),
        nonce: bs58.encode(nonce),
        redirect_link: createRedirectUrl('onPhantomConnected'),
        payload: bs58.encode(encryptedPayload),
      };

      const url = buildUrl('signAndSendTransaction', params);
      addLog('💸 Opening Phantom for transaction signing...');
      addLog(`📱 Transaction URL: ${url.slice(0, 100)}...`);
      
      await Linking.openURL(url);
    } catch (error) {
      addLog(`❌ Transaction preparation failed: ${error.message}`);
      Alert.alert('트랜잭션 오류', `트랜잭션 생성 중 오류가 발생했습니다: ${error.message}`);
    }
  };

  // Test redirect URL functionality
  const testRedirectUrl = async () => {
    const testUrl = createRedirectUrl(`onPhantomConnected?test=true&timestamp=${Date.now()}`);
    addLog(`🧪 Testing redirect URL: ${testUrl}`);
    
    try {
      const canOpen = await Linking.canOpenURL(testUrl);
      addLog(`✅ Can open URL: ${canOpen}`);
      
      if (canOpen) {
        await Linking.openURL(testUrl);
        addLog('✅ Successfully opened test redirect URL');
      } else {
        addLog('❌ Cannot open redirect URL - scheme may not be registered');
        Alert.alert(
          'URL Scheme 테스트 실패', 
          'URL scheme이 제대로 등록되지 않았을 수 있습니다.\n\n앱을 다시 빌드해보세요.'
        );
      }
    } catch (error) {
      addLog(`❌ Redirect URL test failed: ${error.message}`);
      Alert.alert('테스트 실패', `URL 테스트 중 오류: ${error.message}`);
    }
  };

  // Test general linking capabilities
  const testLinkingCapabilities = async () => {
    addLog('🔍 Testing linking capabilities...');
    
    const testUrls = [
      createRedirectUrl('test'),
      createRedirectUrl('onPhantomConnected'),
      'https://phantom.app',
      'phantom://v1/connect'
    ];

    for (const url of testUrls) {
      try {
        const canOpen = await Linking.canOpenURL(url);
        addLog(`${canOpen ? '✅' : '❌'} ${url}: ${canOpen ? 'OK' : 'Cannot open'}`);
      } catch (error) {
        addLog(`❌ ${url}: Error - ${error.message}`);
      }
    }

    // Test getting initial URL
    try {
      const initialUrl = await Linking.getInitialURL();
      addLog(`📱 Initial URL: ${initialUrl || 'None'}`);
    } catch (error) {
      addLog(`❌ Get initial URL error: ${error.message}`);
    }

    // Test creating various URLs with try-catch
    addLog('📝 Testing URL creation:');
    try {
      addLog(`🔗 Basic: ${createRedirectUrl('test')}`);
      addLog(`🔗 Connected: ${createRedirectUrl('onPhantomConnected')}`);
      addLog(`🔗 Empty: ${createRedirectUrl('')}`);
    } catch (error) {
      addLog(`❌ URL creation test failed: ${error.message}`);
    }
  };

  // Simulate a Phantom response for testing
  const simulatePhantomResponse = () => {
    addLog('🎭 Simulating Phantom response...');
    
    const mockResponse = {
      phantom_encryption_public_key: bs58.encode(nacl.randomBytes(32)),
      nonce: bs58.encode(nacl.randomBytes(24)),
      data: bs58.encode(Buffer.from(JSON.stringify({ public_key: 'mock_wallet_address_' + Date.now() })))
    };

    try {
      // Create URL with parameters manually for simulation
      const baseUrl = createRedirectUrl('onPhantomConnected');
      const params = new URLSearchParams(mockResponse);
      const testUrl = `${baseUrl}?${params.toString()}`;

      addLog(`📤 Simulated URL: ${testUrl.slice(0, 100)}...`);
      
      setTimeout(() => {
        Linking.openURL(testUrl).catch(error => {
          addLog(`❌ Simulation failed: ${error.message}`);
        });
      }, 1000);
    } catch (error) {
      addLog(`❌ Failed to create simulation URL: ${error.message}`);
    }
  };

  // Initialize connection state
  useEffect(() => {
    addLog('🚀 Phantom Deep Link initialized');
    addLog(`🔑 dApp Public Key: ${bs58.encode(dAppKeyPair.publicKey).slice(0, 20)}...`);
    addLog('💡 Ready to connect to Phantom wallet');
  }, []);

  if (!phantomWalletPublicKey) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Phantom Deep Link (공식 방식)</Text>
        <Text style={styles.subtitle}>기존 Phantom 앱과 연결</Text>
        
        <TouchableOpacity style={styles.button} onPress={connect}>
          <Text style={styles.buttonText}>Phantom 지갑 연결</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.button, { backgroundColor: '#4CAF50' }]} 
          onPress={testRedirectUrl}
        >
          <Text style={styles.buttonText}>Redirect URL 테스트</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.button, { backgroundColor: '#FF9800' }]} 
          onPress={testLinkingCapabilities}
        >
          <Text style={styles.buttonText}>링킹 기능 테스트</Text>
        </TouchableOpacity>

        <View style={styles.logContainer}>
          <Text style={styles.logTitle}>로그:</Text>
          <ScrollView style={styles.logScroll}>
            {logs.map((log, index) => (
              <Text key={index} style={styles.logText}>{log}</Text>
            ))}
          </ScrollView>
        </View>

        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>필수 조건:</Text>
          <Text style={styles.infoText}>• Phantom 지갑 앱 설치 필요</Text>
          <Text style={styles.infoText}>• Devnet에서 테스트</Text>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Phantom 연결됨 (공식 방식)</Text>
      
      <View style={styles.addressContainer}>
        <Text style={styles.addressLabel}>공개키:</Text>
        <Text style={styles.address}>
          {phantomWalletPublicKey.slice(0, 20)}...{phantomWalletPublicKey.slice(-10)}
        </Text>
      </View>

      <View style={styles.section}>
        <TouchableOpacity style={styles.button} onPress={signMessage}>
          <Text style={styles.buttonText}>메시지 서명</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.button} onPress={signAndSendTransaction}>
          <Text style={styles.buttonText}>트랜잭션 전송</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.button, styles.disconnectButton]} 
          onPress={disconnect}
        >
          <Text style={styles.buttonText}>연결 해제</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.button, { backgroundColor: '#9C27B0' }]} 
          onPress={simulatePhantomResponse}
        >
          <Text style={styles.buttonText}>Phantom 응답 시뮬레이션</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.logContainer}>
        <Text style={styles.logTitle}>로그:</Text>
        <ScrollView style={styles.logScroll}>
          {logs.map((log, index) => (
            <Text key={index} style={styles.logText}>{log}</Text>
          ))}
        </ScrollView>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
    color: '#333',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 30,
    color: '#666',
  },
  addressContainer: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
  },
  addressLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5,
    color: '#333',
  },
  address: {
    fontSize: 14,
    fontFamily: 'monospace',
    color: '#666',
    backgroundColor: '#f0f0f0',
    padding: 10,
    borderRadius: 5,
  },
  section: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#ab9ff2',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginVertical: 5,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  disconnectButton: {
    backgroundColor: '#ff6b6b',
  },
  logContainer: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
    height: 200,
  },
  logTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  logScroll: {
    flex: 1,
  },
  logText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
    fontFamily: 'monospace',
  },
  infoBox: {
    backgroundColor: '#e8f4f8',
    padding: 15,
    borderRadius: 10,
    marginTop: 20,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
});