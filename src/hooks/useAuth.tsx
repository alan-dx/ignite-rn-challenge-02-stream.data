import { makeRedirectUri, revokeAsync, startAsync } from 'expo-auth-session';
import React, { useEffect, createContext, useContext, useState, ReactNode } from 'react';
import { generateRandom } from 'expo-auth-session/build/PKCE';

import { api } from '../services/api';

interface User {
  id: number;
  display_name: string;
  email: string;
  profile_image_url: string;
}

interface AuthContextData {
  user: User;
  isLoggingOut: boolean;
  isLoggingIn: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

interface AuthProviderData {
  children: ReactNode;
}

const AuthContext = createContext({} as AuthContextData);

const twitchEndpoints = {
  authorization: 'https://id.twitch.tv/oauth2/authorize',
  revocation: 'https://id.twitch.tv/oauth2/revoke'
};

function AuthProvider({ children }: AuthProviderData) {
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [user, setUser] = useState({} as User);
  const [userToken, setUserToken] = useState('');

  // get CLIENT_ID from environment variables
  const CLIENT_ID = "gcsa4wlawigain8rxc64vz65dz4uym"

  async function signIn() {
    try {
      // set isLoggingIn to true
      setIsLoggingIn(true)
      console.log('CLIENT_ID', CLIENT_ID)

      // REDIRECT_URI - create OAuth redirect URI using makeRedirectUri() with "useProxy" option set to true
      const REDIRECT_URI = makeRedirectUri({ useProxy: true })
      // RESPONSE_TYPE - set to "token"
      const RESPONSE_TYPE = "token"
      // SCOPE - create a space-separated list of the following scopes: "openid", "user:read:email" and "user:read:follows"
      const SCOPE = encodeURI("openid user:read:email user:read:follows")
      // FORCE_VERIFY - set to true
      const FORCE_VERIFY = true
      // STATE - generate random 30-length string using generateRandom() with "size" set to 30
      const STATE = generateRandom(30)

      // assemble authUrl with twitchEndpoint authorization, client_id, 
      // redirect_uri, response_type, scope, force_verify and state
      const authUrl = twitchEndpoints.authorization +
      `?client_id=${CLIENT_ID}` + 
      `&redirect_uri=${REDIRECT_URI}` + 
      `&response_type=${RESPONSE_TYPE}` + 
      `&scope=${SCOPE}` + 
      `&force_verify=${FORCE_VERIFY}` +
      `&state=${STATE}`;

      // call startAsync with authUrl

      const response = await startAsync({ authUrl }) as any

      // verify if startAsync response.type equals "success" and response.params.error differs from "access_denied"
      // if true, do the following:
      if (response.type === "success" && response.params.error !== "access_denied") {
        // verify if startAsync response.params.state differs from STATE
        // if true, do the following:
          // throw an error with message "Invalid state value"
        
          if (response.params.state !== STATE) {
            throw new Error("Invalid state value")
          }
  
        // add access_token to request's authorization header
        api.defaults.headers.authorization = `Bearer ${response.params.access_token}`
  
        // call Twitch API's users route
        const userResponse = await api.get('/users');
  
        // set user state with response from Twitch API's route "/users"
        setUser(userResponse.data.data[0])
        // set userToken state with response's access_token from startAsync
        setUserToken(response.params.access_token)

      }

    } catch (error) {
      // throw an error
      throw new Error()
    } finally {
      // set isLoggingIn to false
      setIsLoggingIn(false)
    }
  }

  async function signOut() {
    try {
      // set isLoggingOut to true
      setIsLoggingOut(true)

      // call revokeAsync with access_token, client_id and twitchEndpoint revocation
      await revokeAsync({
        token: userToken,
        clientId: CLIENT_ID
      }, {
        revocationEndpoint: twitchEndpoints.revocation
      })

    } catch (error) {
    } finally {
      // set user state to an empty User object
      setUser({} as User)
      // set userToken state to an empty string
      setUserToken('')

      // remove "access_token" from request's authorization header
      delete api.defaults.headers.authorization;

      // set isLoggingOut to false
      setIsLoggingOut(false)
    }
  }

  useEffect(() => {
    // add client_id to request's "Client-Id" header
    api.defaults.headers["Client-Id"] = CLIENT_ID
  }, [])

  return (
    <AuthContext.Provider value={{ user, isLoggingOut, isLoggingIn, signIn, signOut }}>
      { children }
    </AuthContext.Provider>
  )
}

function useAuth() {
  const context = useContext(AuthContext);

  return context;
}

export { AuthProvider, useAuth };
